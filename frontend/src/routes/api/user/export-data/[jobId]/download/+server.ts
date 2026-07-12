import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireSession } from '$lib/server/auth';
import { getDatabase } from '$lib/db/drizzle';
import { auditLogs, dataExportJobs, ExportJobStatus } from '$lib/db/schema';
import { decodeExportArtifact } from '$lib/gdpr/export-artifact';
import { and, eq, gt, isNotNull, lt, sql } from 'drizzle-orm';

const MAX_DOWNLOADS = 3;

/**
 * GET /api/user/export-data/[jobId]/download
 * Atomically enforces owner, expiry, and download-count constraints and returns
 * the durable artifact from PostgreSQL. Failed integrity checks roll back the
 * consumed count.
 */
export const GET: RequestHandler = async (event) => {
	const session = await requireSession(event);
	const userId = session.user.id;
	const db = await getDatabase();

	try {
		const result = await db.transaction(async (tx) => {
			const [job] = await tx
				.update(dataExportJobs)
				.set({
					downloadCount: sql`${dataExportJobs.downloadCount} + 1`,
					updatedAt: new Date()
				})
				.where(
					and(
						eq(dataExportJobs.id, event.params.jobId),
						eq(dataExportJobs.userId, userId),
						eq(dataExportJobs.status, ExportJobStatus.COMPLETED),
						gt(dataExportJobs.expiresAt, new Date()),
						lt(dataExportJobs.downloadCount, MAX_DOWNLOADS),
						isNotNull(dataExportJobs.artifactData),
						isNotNull(dataExportJobs.artifactSha256),
						isNotNull(dataExportJobs.fileSize)
					)
				)
				.returning();

			if (!job?.artifactData || !job.artifactSha256 || job.fileSize === null) return null;

			const bytes = await decodeExportArtifact(job.artifactData, job.fileSize, job.artifactSha256);

			await tx.insert(auditLogs).values({
				userId,
				eventType: 'data_export_downloaded',
				eventCategory: 'settings',
				details: { jobId: job.id, downloadCount: job.downloadCount }
			});

			return { bytes, contentType: job.contentType || 'application/json', jobId: job.id };
		});

		if (!result) {
			return json({ error: 'Export is unavailable' }, { status: 404 });
		}

		return new Response(Buffer.from(result.bytes), {
			status: 200,
			headers: {
				'content-type': result.contentType,
				'content-disposition': `attachment; filename="keyfate-export-${result.jobId}.json"`,
				'cache-control': 'private, no-store, max-age=0',
				'x-content-type-options': 'nosniff'
			}
		});
	} catch (error) {
		console.error('Error downloading data export:', error);
		return json({ error: 'Failed to download export' }, { status: 500 });
	}
};
