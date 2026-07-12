/**
 * Crash-safe data export worker.
 *
 * Jobs are claimed with expiring leases. Every terminal write is fenced by the
 * lease identifier so a stale replica cannot overwrite a newer worker.
 */

import { randomUUID } from 'node:crypto';
import { getDatabase } from '$lib/db/get-database';
import { dataExportJobs, users, ExportJobStatus } from '$lib/db/schema';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { logger } from '$lib/logger';
import { generateUserDataExport } from '$lib/gdpr/export-service';
import { createExportArtifact, type ExportArtifact } from '$lib/gdpr/export-artifact';
import { sendEmail } from '$lib/email/email-service';
import { SITE_URL } from '$lib/env';

const MAX_JOBS_PER_RUN = 10;
const LEASE_DURATION_MS = 15 * 60 * 1000;
const DOWNLOAD_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ProcessExportsResult {
	success: boolean;
	processed: number;
	succeeded: number;
	failed: number;
	successCount: number;
	failureCount: number;
	message?: string;
}

type Database = Awaited<ReturnType<typeof getDatabase>>;
type ExportJob = typeof dataExportJobs.$inferSelect;

function claimableExport(now: Date) {
	return or(
		eq(dataExportJobs.status, ExportJobStatus.PENDING),
		and(
			eq(dataExportJobs.status, ExportJobStatus.PROCESSING),
			or(isNull(dataExportJobs.leaseExpiresAt), lt(dataExportJobs.leaseExpiresAt, now))
		)
	);
}

export async function claimExportJob(
	db: Database,
	jobId: string,
	now: Date
): Promise<{ job: ExportJob; leaseId: string } | null> {
	const leaseId = randomUUID();
	const [job] = await db
		.update(dataExportJobs)
		.set({
			status: ExportJobStatus.PROCESSING,
			leaseId,
			leaseExpiresAt: new Date(now.getTime() + LEASE_DURATION_MS),
			processingStartedAt: now,
			errorMessage: null,
			updatedAt: now
		})
		.where(and(eq(dataExportJobs.id, jobId), claimableExport(now)))
		.returning();

	return job ? { job, leaseId } : null;
}

export async function completeExportClaim(
	db: Database,
	jobId: string,
	leaseId: string,
	artifact: ExportArtifact,
	completedAt: Date = new Date()
): Promise<boolean> {
	const completed = await db
		.update(dataExportJobs)
		.set({
			status: ExportJobStatus.COMPLETED,
			fileUrl: null,
			fileSize: artifact.fileSize,
			artifactData: artifact.encodedData,
			artifactSha256: artifact.sha256,
			artifactStoredSize: artifact.storedSize,
			contentType: artifact.contentType,
			completedAt,
			expiresAt: new Date(completedAt.getTime() + DOWNLOAD_WINDOW_MS),
			leaseId: null,
			leaseExpiresAt: null,
			errorMessage: null,
			updatedAt: completedAt
		})
		.where(and(eq(dataExportJobs.id, jobId), eq(dataExportJobs.leaseId, leaseId)))
		.returning({ id: dataExportJobs.id });

	return completed.length > 0;
}

async function notifyExportReady(job: ExportJob, fileSize: number): Promise<void> {
	const db = await getDatabase();
	const [user] = await db.select().from(users).where(eq(users.id, job.userId));
	if (!user) return;

	const downloadPath = `${SITE_URL || 'https://keyfate.com'}/api/user/export-data/${job.id}/download`;
	await sendEmail({
		to: user.email,
		subject: 'KeyFate: Your Data Export is Ready',
		html: `
            <h2>Your Data Export is Ready</h2>
            <p>Your data export has been completed and is ready for download.</p>
            <p><a href="${downloadPath}">Download Your Data</a></p>
            <p><strong>File Size:</strong> ${(fileSize / 1024 / 1024).toFixed(2)} MB</p>
            <p>The authenticated download expires in 24 hours and is limited to 3 downloads.</p>
          `,
		unsubscribeGroup: 'ACCOUNT_NOTIFICATIONS'
	});
}

async function processClaim(db: Database, job: ExportJob, leaseId: string): Promise<boolean> {
	try {
		const exportData = await generateUserDataExport(job.userId);
		const artifact = await createExportArtifact(exportData);

		if (!(await completeExportClaim(db, job.id, leaseId, artifact))) {
			logger.warn('Export lease was lost before completion', { jobId: job.id });
			return false;
		}

		try {
			await notifyExportReady(job, artifact.fileSize);
		} catch (error) {
			logger.error(
				'Export completed but notification failed',
				error instanceof Error ? error : undefined,
				{
					jobId: job.id
				}
			);
		}

		logger.info('Export job completed successfully', { jobId: job.id });
		return true;
	} catch (error) {
		logger.error('Error processing export job', error instanceof Error ? error : undefined, {
			jobId: job.id
		});

		await db
			.update(dataExportJobs)
			.set({
				status: ExportJobStatus.FAILED,
				errorMessage: error instanceof Error ? error.message : 'Unknown error',
				leaseId: null,
				leaseExpiresAt: null,
				updatedAt: new Date()
			})
			.where(and(eq(dataExportJobs.id, job.id), eq(dataExportJobs.leaseId, leaseId)));
		return false;
	}
}

export async function runProcessExports(): Promise<ProcessExportsResult> {
	logger.info('Processing data export jobs');
	const db = await getDatabase();
	const now = new Date();

	const candidates = await db
		.select({ id: dataExportJobs.id })
		.from(dataExportJobs)
		.where(claimableExport(now))
		.limit(MAX_JOBS_PER_RUN * 2);

	let successCount = 0;
	let failureCount = 0;
	let processed = 0;

	for (const candidate of candidates) {
		if (processed >= MAX_JOBS_PER_RUN) break;
		const claim = await claimExportJob(db, candidate.id, new Date());
		if (!claim) continue;

		processed++;
		if (await processClaim(db, claim.job, claim.leaseId)) successCount++;
		else failureCount++;
	}

	if (processed === 0) {
		return {
			success: true,
			processed: 0,
			succeeded: 0,
			failed: 0,
			successCount: 0,
			failureCount: 0,
			message: 'No pending exports'
		};
	}

	logger.info('Export processing complete', { successCount, failureCount });
	return {
		success: failureCount === 0,
		processed,
		succeeded: successCount,
		failed: failureCount,
		successCount,
		failureCount
	};
}
