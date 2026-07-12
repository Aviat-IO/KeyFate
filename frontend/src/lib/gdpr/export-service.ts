import { getDatabase } from '$lib/db/drizzle';
import {
	users,
	secrets,
	secretRecipients,
	checkinHistory,
	auditLogs,
	userSubscriptions,
	paymentHistory,
	dataExportJobs,
	ExportJobStatus
} from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface UserDataExport {
	exportedAt: string;
	user: {
		id: string;
		email: string;
		name: string | null;
		emailVerified: Date | null;
		createdAt: Date;
	};
	secrets: Array<{
		id: string;
		title: string;
		checkInDays: number;
		status: string;
		createdAt: Date;
		lastCheckIn: Date | null;
		nextCheckIn: Date | null;
		recipients: Array<{
			name: string;
			email: string | null;
			phone: string | null;
		}>;
	}>;
	checkIns: Array<{
		secretId: string;
		timestamp: Date;
		ipAddress: string | null;
	}>;
	auditLogs: Array<{
		eventType: string;
		category: string;
		timestamp: Date;
		metadata: Record<string, unknown> | null;
	}>;
	subscription: {
		tier: string;
		status: string;
		startDate: Date | null;
		endDate: Date | null;
	} | null;
	paymentHistory: Array<{
		transactionId: string;
		amount: string;
		currency: string;
		status: string;
		createdAt: Date;
	}>;
}

export async function generateUserDataExport(userId: string): Promise<UserDataExport> {
	const db = await getDatabase();
	const [user] = await db.select().from(users).where(eq(users.id, userId));

	if (!user) {
		throw new Error('User not found');
	}

	const userSecrets = await db.select().from(secrets).where(eq(secrets.userId, userId));

	const secretsWithDetails = await Promise.all(
		userSecrets.map(async (secret) => {
			const recipients = await db
				.select()
				.from(secretRecipients)
				.where(eq(secretRecipients.secretId, secret.id));

			return {
				id: secret.id,
				title: secret.title,
				checkInDays: secret.checkInDays,
				status: secret.status,
				createdAt: secret.createdAt,
				lastCheckIn: secret.lastCheckIn,
				nextCheckIn: secret.nextCheckIn,
				recipients: recipients.map((r) => ({
					name: r.name,
					email: r.email,
					phone: r.phone
				}))
			};
		})
	);

	const userCheckIns = await db
		.select()
		.from(checkinHistory)
		.where(eq(checkinHistory.userId, userId))
		.orderBy(desc(checkinHistory.checkedInAt));

	const userAuditLogs = await db
		.select()
		.from(auditLogs)
		.where(eq(auditLogs.userId, userId))
		.orderBy(desc(auditLogs.createdAt));

	const [subscription] = await db
		.select()
		.from(userSubscriptions)
		.where(eq(userSubscriptions.userId, userId));

	const payments = await db
		.select()
		.from(paymentHistory)
		.where(eq(paymentHistory.userId, userId))
		.orderBy(desc(paymentHistory.createdAt));

	return {
		exportedAt: new Date().toISOString(),
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			emailVerified: user.emailVerified,
			createdAt: user.createdAt
		},
		secrets: secretsWithDetails,
		checkIns: userCheckIns.map((c) => ({
			secretId: c.secretId,
			timestamp: c.checkedInAt,
			ipAddress: null
		})),
		auditLogs: userAuditLogs.map((log) => ({
			eventType: log.eventType,
			category: log.eventCategory,
			timestamp: log.createdAt,
			metadata: (log.details as Record<string, unknown>) || {}
		})),
		subscription: subscription
			? {
					tier: subscription.tierId,
					status: subscription.status,
					startDate: subscription.currentPeriodStart,
					endDate: subscription.currentPeriodEnd
				}
			: null,
		paymentHistory: payments.map((p) => ({
			transactionId: p.providerPaymentId,
			amount: p.amount,
			currency: p.currency,
			status: p.status,
			createdAt: p.createdAt
		}))
	};
}

export async function hasRecentExportRequest(userId: string): Promise<boolean> {
	const db = await getDatabase();
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

	const [recentJob] = await db
		.select()
		.from(dataExportJobs)
		.where(and(eq(dataExportJobs.userId, userId)))
		.orderBy(desc(dataExportJobs.createdAt))
		.limit(1);

	return recentJob ? recentJob.createdAt > oneDayAgo : false;
}

export async function createPendingExportJob(userId: string) {
	const db = await getDatabase();
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	const [job] = await db
		.insert(dataExportJobs)
		.values({
			userId,
			status: ExportJobStatus.PENDING,
			expiresAt
		})
		.returning();

	return job;
}

export async function getExportJob(jobId: string, userId: string) {
	const db = await getDatabase();
	const [job] = await db
		.select({
			id: dataExportJobs.id,
			userId: dataExportJobs.userId,
			status: dataExportJobs.status,
			fileSize: dataExportJobs.fileSize,
			downloadCount: dataExportJobs.downloadCount,
			expiresAt: dataExportJobs.expiresAt,
			createdAt: dataExportJobs.createdAt,
			completedAt: dataExportJobs.completedAt,
			errorMessage: dataExportJobs.errorMessage
		})
		.from(dataExportJobs)
		.where(and(eq(dataExportJobs.id, jobId), eq(dataExportJobs.userId, userId)));

	return job;
}
