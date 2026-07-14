import { ensureUserExists } from '$lib/auth/user-verification';
import { createCSRFErrorResponse, requireCSRFProtection } from '$lib/csrf';
import { getDatabase } from '$lib/db/drizzle';
import { checkinHistory, secrets } from '$lib/db/schema';
import { getSecretWithRecipients } from '$lib/db/queries/secrets';
import { mapDrizzleSecretToApiShape } from '$lib/db/secret-mapper';
import { logger } from '$lib/logger';
import { logCheckIn } from '$lib/services/audit-logger';
import { scheduleRemindersForSecret } from '$lib/services/reminder-scheduler';
import { and, eq } from 'drizzle-orm';

/** Explicit boundary for the check-in handler's side effects and test doubles. */
export const checkInDependencies = {
	and,
	checkinHistory,
	createCSRFErrorResponse,
	ensureUserExists,
	eq,
	getDatabase,
	getSecretWithRecipients,
	logCheckIn,
	logger,
	mapDrizzleSecretToApiShape,
	requireCSRFProtection,
	scheduleRemindersForSecret,
	secrets
};
