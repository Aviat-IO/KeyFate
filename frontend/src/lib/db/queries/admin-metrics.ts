import { getDatabase } from "$lib/db/drizzle"
import {
	secrets,
	users,
	disclosureLog,
	emailFailures,
	userSubscriptions,
	subscriptionTiers,
	checkinHistory,
} from "$lib/db/schema"
import { eq, sql, and, desc, isNull, inArray } from "drizzle-orm"

export async function getSecretStatusCounts() {
	const db = await getDatabase()
	const rows = await db
		.select({
			status: secrets.status,
			count: sql<number>`count(*)`,
		})
		.from(secrets)
		.groupBy(secrets.status)

	const counts = { active: 0, paused: 0, triggered: 0, failed: 0, total: 0 }
	for (const row of rows) {
		const c = Number(row.count)
		if (row.status in counts) {
			counts[row.status as keyof typeof counts] = c
		}
		counts.total += c
	}
	return counts
}

export async function getUserCounts() {
	const db = await getDatabase()

	const [[totalRow], [activeSecretUsersRow], [proUsersRow]] = await Promise.all([
		db.select({ count: sql<number>`count(*)` }).from(users),

		db
			.select({ count: sql<number>`count(distinct ${secrets.userId})` })
			.from(secrets)
			.where(inArray(secrets.status, ["active", "paused"])),

		db
			.select({ count: sql<number>`count(*)` })
			.from(userSubscriptions)
			.innerJoin(subscriptionTiers, eq(userSubscriptions.tierId, subscriptionTiers.id))
			.where(
				and(eq(userSubscriptions.status, "active"), eq(subscriptionTiers.name, "pro")),
			),
	])

	return {
		total: Number(totalRow?.count ?? 0),
		withActiveSecrets: Number(activeSecretUsersRow?.count ?? 0),
		proUsers: Number(proUsersRow?.count ?? 0),
	}
}

export async function getEmailDeliveryStats() {
	const db = await getDatabase()
	const now = new Date()
	const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

	const [row] = await db
		.select({
			sent: sql<number>`count(*) filter (where ${disclosureLog.status} = 'sent')`,
			failed: sql<number>`count(*) filter (where ${disclosureLog.status} = 'failed')`,
			pending: sql<number>`count(*) filter (where ${disclosureLog.status} = 'pending')`,
			sentLast24h: sql<number>`count(*) filter (where ${disclosureLog.status} = 'sent' and ${disclosureLog.createdAt} >= ${oneDayAgo})`,
			failedLast24h: sql<number>`count(*) filter (where ${disclosureLog.status} = 'failed' and ${disclosureLog.createdAt} >= ${oneDayAgo})`,
		})
		.from(disclosureLog)

	return {
		sent: Number(row?.sent ?? 0),
		failed: Number(row?.failed ?? 0),
		pending: Number(row?.pending ?? 0),
		sentLast24h: Number(row?.sentLast24h ?? 0),
		failedLast24h: Number(row?.failedLast24h ?? 0),
	}
}

export async function getFailedSecrets(limit = 20) {
	const db = await getDatabase()
	return db
		.select({
			id: secrets.id,
			title: secrets.title,
			ownerEmail: users.email,
			lastError: secrets.lastError,
			updatedAt: secrets.updatedAt,
			retryCount: secrets.retryCount,
		})
		.from(secrets)
		.innerJoin(users, eq(secrets.userId, users.id))
		.where(eq(secrets.status, "failed"))
		.orderBy(desc(secrets.updatedAt))
		.limit(limit)
}

export async function getRecentEmailFailures(limit = 20) {
	const db = await getDatabase()
	return db
		.select()
		.from(emailFailures)
		.where(isNull(emailFailures.resolvedAt))
		.orderBy(desc(emailFailures.createdAt))
		.limit(limit)
}

export async function getRecentActivity(limit = 20) {
	const db = await getDatabase()
	return db
		.select({
			id: checkinHistory.id,
			secretId: checkinHistory.secretId,
			userId: checkinHistory.userId,
			userEmail: users.email,
			checkedInAt: checkinHistory.checkedInAt,
			nextCheckIn: checkinHistory.nextCheckIn,
			createdAt: checkinHistory.createdAt,
		})
		.from(checkinHistory)
		.innerJoin(users, eq(checkinHistory.userId, users.id))
		.orderBy(desc(checkinHistory.checkedInAt))
		.limit(limit)
}
