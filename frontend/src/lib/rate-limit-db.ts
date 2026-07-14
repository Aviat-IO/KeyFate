import { rateLimits } from '$lib/db/schema';
import { logger } from '$lib/logger';
import { sql } from 'drizzle-orm';

export type RateLimitType =
	| 'ip'
	| 'user'
	| 'checkIn'
	| 'secretCreation'
	| 'otp'
	| 'registration'
	| 'verify-email'
	| 'resend-verification'
	| 'request-password-reset'
	| 'reset-password-attempt';

export interface RateLimitResult {
	success: boolean;
	available: boolean;
	reason?: 'limit' | 'unavailable';
	limit: number;
	remaining: number;
	reset: number;
}

// Lazy load the managed database to avoid build-time initialization.
async function getDb() {
	const { getDatabase } = await import('$lib/db/drizzle');
	return getDatabase();
}

export async function checkRateLimitDB(
	type: RateLimitType,
	identifier: string,
	limit: number,
	windowMs: number = 60000
): Promise<RateLimitResult> {
	const key = `${type}:${identifier}`;
	const now = new Date();
	const expiresAt = new Date(now.getTime() + windowMs);

	try {
		const db = await getDb();
		const [entry] = await db
			.insert(rateLimits)
			.values({ key, count: 1, expiresAt })
			.onConflictDoUpdate({
				target: rateLimits.key,
				set: {
					count: sql<number>`CASE
						WHEN ${rateLimits.expiresAt} <= CURRENT_TIMESTAMP THEN 1
						ELSE ${rateLimits.count} + 1
					END`,
					expiresAt: sql<Date>`CASE
						WHEN ${rateLimits.expiresAt} <= CURRENT_TIMESTAMP
							THEN CURRENT_TIMESTAMP + (${windowMs} * interval '1 millisecond')
						ELSE ${rateLimits.expiresAt}
					END`
				}
			})
			.returning({ count: rateLimits.count, expiresAt: rateLimits.expiresAt });

		if (!entry) {
			throw new Error('Rate limit upsert returned no decision');
		}

		const success = entry.count <= limit;
		return {
			success,
			available: true,
			reason: success ? undefined : 'limit',
			limit,
			remaining: Math.max(0, limit - entry.count),
			reset: Math.ceil(entry.expiresAt.getTime() / 1000)
		};
	} catch (error) {
		logger.error('Rate limit decision failed', error instanceof Error ? error : undefined, {
			type
		});
		return {
			success: false,
			available: false,
			reason: 'unavailable',
			limit,
			remaining: 0,
			reset: Math.ceil((Date.now() + Math.min(windowMs, 60_000)) / 1000)
		};
	}
}

export async function cleanupExpiredRateLimits(): Promise<number> {
	try {
		const db = await getDb();
		const now = new Date();
		const result = await db.delete(rateLimits).where(sql`${rateLimits.expiresAt} < ${now}`);

		// Drizzle doesn't return rowCount in a standard way, so we'll return 0
		return 0;
	} catch (error) {
		console.error('Rate limit cleanup failed:', error);
		return 0;
	}
}
