import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkInDependencies } from '$lib/server/check-in-dependencies';

const {
	and,
	checkinHistory,
	createCSRFErrorResponse,
	ensureUserExists,
	eq,
	getDatabase,
	getSecretWithRecipients: getSecretAfterCheckIn,
	logCheckIn,
	logger,
	mapDrizzleSecretToApiShape,
	requireCSRFProtection,
	scheduleRemindersForSecret,
	secrets
} = checkInDependencies;

export const POST: RequestHandler = async (event) => {
	try {
		const id = event.params.id;

		const csrfCheck = await requireCSRFProtection(event);
		if (!csrfCheck.valid) {
			return createCSRFErrorResponse();
		}

		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Ensure user exists in database before creating check-in history.
		try {
			await ensureUserExists(session);
		} catch (userError) {
			logger.error(
				'Check-in user verification failed',
				userError instanceof Error ? userError : undefined
			);
			return json({ error: 'Failed to verify user account' }, { status: 500 });
		}

		const userId = session.user.id;

		const database = await getDatabase();

		// Use transaction with SELECT FOR UPDATE to prevent TOCTOU race
		const result = await database.transaction(async (tx) => {
			// Lock the secret row to prevent concurrent check-ins
			const [secret] = await tx
				.select()
				.from(secrets)
				.where(and(eq(secrets.id, id), eq(secrets.userId, userId)))
				.for('update');

			if (!secret) return { kind: 'not_found' as const };

			const now = new Date();
			if (secret.triggeredAt || secret.status === 'triggered') {
				return { kind: 'already_disclosed' as const };
			}
			const hasLiveDisclosureLease =
				Boolean(secret.processingLeaseId) &&
				(!secret.processingLeaseExpiresAt || secret.processingLeaseExpiresAt > now);
			if (hasLiveDisclosureLease) return { kind: 'disclosure_in_progress' as const };
			if (secret.bitcoinDeliveryStatus === 'ready') {
				return { kind: 'bitcoin_refresh_required' as const };
			}

			const nextCheckIn = new Date(now.getTime() + secret.checkInDays * 24 * 60 * 60 * 1000);

			// Build update payload — reset failure fields if recovering from failed status
			const updatePayload: Record<string, unknown> = {
				lastCheckIn: now,
				nextCheckIn,
				status: secret.status === 'paused' ? 'paused' : 'active',
				processingStartedAt: null,
				processingLeaseId: null,
				processingLeaseExpiresAt: null,
				triggeredAt: null,
				retryCount: 0,
				lastRetryAt: null,
				lastError: null,
				updatedAt: now
			};

			// Update the secret with new check-in times
			const [updatedSecret] = await tx
				.update(secrets)
				.set(updatePayload)
				.where(and(eq(secrets.id, id), eq(secrets.userId, userId)))
				.returning();

			// Record check-in history
			await tx.insert(checkinHistory).values({
				secretId: id,
				userId,
				checkedInAt: now,
				nextCheckIn: nextCheckIn
			});

			return {
				kind: 'success' as const,
				secret: updatedSecret,
				nextCheckIn,
				checkInDays: secret.checkInDays
			};
		});

		if (result.kind === 'not_found') {
			return json({ error: 'Secret not found' }, { status: 404 });
		}
		if (result.kind === 'already_disclosed') {
			return json({ error: 'Secret disclosure is already complete' }, { status: 409 });
		}
		if (result.kind === 'disclosure_in_progress') {
			return json({ error: 'Secret disclosure is already in progress' }, { status: 409 });
		}
		if (result.kind === 'bitcoin_refresh_required') {
			return json(
				{ error: 'Refresh the Bitcoin continuity generation to complete this check-in' },
				{ status: 409 }
			);
		}

		const warnings: string[] = [];
		try {
			await logCheckIn(
				session.user.id,
				id,
				{
					nextCheckIn: result.nextCheckIn.toISOString(),
					checkInDays: result.checkInDays
				},
				event
			);
		} catch {
			warnings.push('audit_reconciliation_required');
		}

		try {
			await scheduleRemindersForSecret(id, result.nextCheckIn, result.checkInDays);
		} catch {
			warnings.push('reminder_reconciliation_required');
		}

		// Get the updated secret with recipients
		const updatedSecretWithRecipients = await getSecretAfterCheckIn(id, session.user.id);
		if (!updatedSecretWithRecipients) {
			return json({ error: 'Secret not found after update' }, { status: 404 });
		}

		const mapped = mapDrizzleSecretToApiShape(updatedSecretWithRecipients);
		return json({
			success: true,
			secret: mapped,
			next_check_in: mapped.next_check_in,
			...(warnings.length > 0 ? { warnings } : {})
		});
	} catch (error) {
		logger.error('Check-in request failed', error instanceof Error ? error : undefined);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
