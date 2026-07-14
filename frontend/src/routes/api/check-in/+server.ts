import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { capabilityCheckInDependencies } from '$lib/server/capability-check-in-dependencies';

const {
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
} = capabilityCheckInDependencies;

class CheckInConflict extends Error {}

function bitcoinRefreshRequiredResponse() {
	return json(
		{ error: 'Refresh the Bitcoin continuity generation to complete this check-in' },
		{ status: 409 }
	);
}

function invalidTokenResponse() {
	return json(
		{ error: 'Invalid or expired token' },
		{ status: 400, headers: { 'Content-Type': 'application/json' } }
	);
}

async function readToken(request: Request): Promise<string | null> {
	try {
		const body: unknown = await request.json();
		if (
			typeof body === 'object' &&
			body !== null &&
			'token' in body &&
			typeof body.token === 'string' &&
			body.token.length >= 32 &&
			body.token.length <= 256
		) {
			return body.token;
		}
	} catch {
		// The caller receives the same response as any other invalid capability.
	}
	return null;
}

/** Process-only endpoint information; capabilities are accepted only in POST bodies. */
export const GET: RequestHandler = async () =>
	json({
		message: 'Check-in endpoint is active. Use POST method to check in.',
		method: 'GET',
		timestamp: new Date().toISOString()
	});

export const POST: RequestHandler = async (event) => {
	const startTime = Date.now();
	const token = await readToken(event.request);

	console.log('[CHECK-IN] Attempt received', {
		timestamp: new Date().toISOString(),
		hasToken: Boolean(token),
		tokenFingerprint: token ? fingerprintCapability(token) : undefined,
		method: event.request.method,
		url: event.url.pathname
	});

	if (!token) {
		console.warn('[CHECK-IN] Missing or malformed token');
		return invalidTokenResponse();
	}

	if (!process.env.DATABASE_URL) {
		console.error('[CHECK-IN] DATABASE_URL not configured');
		return json({ error: 'Database configuration error' }, { status: 500 });
	}

	const clientIp = getClientIdentifier(event.request);
	const rateLimitResult = await checkRateLimit('checkIn', clientIp, 10);
	if (!rateLimitResult.success) return createRateLimitResponse(rateLimitResult);

	try {
		const db = await getDatabase();
		const storedHash = hashCheckInToken(token);
		const [tokenRow] = await db
			.select()
			.from(checkInTokens)
			.where(
				or(
					and(eq(checkInTokens.tokenVersion, 2), eq(checkInTokens.token, storedHash)),
					and(eq(checkInTokens.tokenVersion, 1), eq(checkInTokens.token, token))
				)
			)
			.limit(1);

		if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt <= new Date()) {
			const elapsed = Date.now() - startTime;
			if (elapsed < 100) await new Promise((resolve) => setTimeout(resolve, 100 - elapsed));
			console.warn('[CHECK-IN] Invalid token attempt', {
				timestamp: new Date().toISOString(),
				tokenFingerprint: fingerprintCapability(token)
			});
			return invalidTokenResponse();
		}

		const [secret] = await db
			.select({
				id: secrets.id,
				userId: secrets.userId,
				title: secrets.title,
				checkInDays: secrets.checkInDays,
				bitcoinDeliveryStatus: secrets.bitcoinDeliveryStatus
			})
			.from(secrets)
			.where(eq(secrets.id, tokenRow.secretId))
			.limit(1);

		if (!secret?.checkInDays) return invalidTokenResponse();
		if (secret.bitcoinDeliveryStatus === 'ready') return bitcoinRefreshRequiredResponse();

		const now = new Date();
		const nextCheckIn = new Date(now.getTime() + secret.checkInDays * 24 * 60 * 60 * 1000);

		try {
			await db.transaction(async (tx) => {
				const [claimedToken] = await tx
					.update(checkInTokens)
					.set({ usedAt: now })
					.where(
						and(
							eq(checkInTokens.id, tokenRow.id),
							isNull(checkInTokens.usedAt),
							gt(checkInTokens.expiresAt, now)
						)
					)
					.returning({ id: checkInTokens.id });
				if (!claimedToken) throw new CheckInConflict('Token was consumed concurrently');

				const [updatedSecret] = await tx
					.update(secrets)
					.set({ lastCheckIn: now, nextCheckIn, updatedAt: now })
					.where(
						and(
							eq(secrets.id, tokenRow.secretId),
							eq(secrets.status, 'active'),
							isNull(secrets.triggeredAt),
							or(isNull(secrets.bitcoinDeliveryStatus), ne(secrets.bitcoinDeliveryStatus, 'ready'))
						)
					)
					.returning({ id: secrets.id });
				if (!updatedSecret) throw new CheckInConflict('Secret is no longer active');

				// Consume every still-valid sibling link issued for this timer cycle.
				await tx
					.update(checkInTokens)
					.set({ usedAt: now })
					.where(and(eq(checkInTokens.secretId, tokenRow.secretId), isNull(checkInTokens.usedAt)));

				await tx.insert(checkinHistory).values({
					secretId: tokenRow.secretId,
					userId: secret.userId,
					checkedInAt: now,
					nextCheckIn
				});
			});
		} catch (error) {
			if (error instanceof CheckInConflict) return invalidTokenResponse();
			throw error;
		}

		try {
			await scheduleRemindersForSecret(tokenRow.secretId, nextCheckIn, secret.checkInDays);
		} catch (error) {
			console.error('[CHECK-IN] Check-in committed but reminder scheduling failed', {
				secretId: tokenRow.secretId,
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}

		console.log('[CHECK-IN] Success', {
			timestamp: new Date().toISOString(),
			secretId: secret.id,
			nextCheckIn: nextCheckIn.toISOString(),
			processingTime: `${Date.now() - startTime}ms`
		});

		return json({
			success: true,
			secretTitle: secret.title,
			nextCheckIn: nextCheckIn.toISOString(),
			message: `Your secret "${secret.title}" timer has been reset.`
		});
	} catch (error) {
		console.error('[CHECK-IN] Internal error', {
			error: error instanceof Error ? error.message : 'Unknown error'
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
