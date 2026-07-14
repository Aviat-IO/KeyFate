import { getDatabase } from '$lib/db/drizzle';
import { checkInTokens, checkinHistory, secrets } from '$lib/db/schema';
import { checkRateLimit, createRateLimitResponse, getClientIdentifier } from '$lib/rate-limit';
import { fingerprintCapability, hashCheckInToken } from '$lib/server/capability-token';
import { scheduleRemindersForSecret } from '$lib/services/reminder-scheduler';
import { and, eq, gt, isNull, ne, or } from 'drizzle-orm';

/** Explicit boundary for public capability check-in side effects and test doubles. */
export const capabilityCheckInDependencies = {
	and,
	checkInTokens,
	checkinHistory,
	checkRateLimit,
	createRateLimitResponse,
	eq,
	fingerprintCapability,
	getClientIdentifier,
	getDatabase,
	gt,
	hashCheckInToken,
	isNull,
	ne,
	or,
	scheduleRemindersForSecret,
	secrets
};
