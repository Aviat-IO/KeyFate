import { createHmac, randomInt } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { getDatabase } from '$lib/db/drizzle';
import { verificationTokens } from '$lib/db/schema';
import { timingSafeStringEqual } from '$lib/crypto/timing-safe';
import { logger } from '$lib/logger';

const OTP_EXPIRATION_MINUTES = 5;
const OTP_MAX_VALIDATION_ATTEMPTS = 5;
const MAX_COLLISION_RETRIES = 3;
const OTP_TOKEN_PREFIX = 'v3';
const LEGACY_NETWORK_BOUND_TOKEN_PREFIX = 'v2';
const OTP_RATE_LIMIT_REQUESTS = process.env.NODE_ENV === 'production' ? 3 : 10;

function getOTPPepper(): string {
	const pepper =
		process.env.OTP_PEPPER ||
		(process.env.NODE_ENV === 'production' ? undefined : process.env.AUTH_SECRET);
	if (!pepper || pepper.length < 32) {
		throw new Error('OTP_PEPPER must be configured with at least 32 characters');
	}
	return pepper;
}

function digest(domain: string, value: string): string {
	return createHmac('sha256', getOTPPepper()).update(`${domain}:${value}`).digest('hex');
}

function createStoredToken(email: string, purpose: string, code: string): string {
	const codeHash = digest('keyfate:otp', `${purpose}:${email}:${code}`);
	return `${OTP_TOKEN_PREFIX}$${codeHash}`;
}

function tokenMatches(
	storedToken: string,
	email: string,
	purpose: string,
	code: string,
	clientIdentifier?: string
): boolean {
	if (storedToken.startsWith(`${OTP_TOKEN_PREFIX}$`)) {
		return timingSafeStringEqual(storedToken, createStoredToken(email, purpose, code));
	}

	// Preserve the short lifetime of already-issued v2 challenges during a
	// rolling deployment. New challenges are deliberately independent of a
	// mutable proxy/mobile address; the address remains only a request limiter.
	if (storedToken.startsWith(`${LEGACY_NETWORK_BOUND_TOKEN_PREFIX}$`)) {
		if (!clientIdentifier) return false;
		const codeHash = digest('keyfate:otp', `${purpose}:${email}:${code}`);
		const clientHash = digest('keyfate:otp-client', clientIdentifier);
		return timingSafeStringEqual(
			storedToken,
			`${LEGACY_NETWORK_BOUND_TOKEN_PREFIX}$${codeHash}$${clientHash}`
		);
	}

	return timingSafeStringEqual(storedToken, code);
}

export function generateOTP(): string {
	return randomInt(0, 100_000_000).toString().padStart(8, '0');
}

interface CreateOTPTokenResult {
	success: boolean;
	code?: string;
	error?: string;
	remaining?: number;
	reason?: 'rate_limited' | 'unavailable' | 'internal';
}

export async function createOTPToken(
	email: string,
	purpose: 'authentication' | 'email_verification',
	clientIdentifier: string = 'unknown'
): Promise<CreateOTPTokenResult> {
	if (clientIdentifier) {
		const { checkRateLimit } = await import('$lib/rate-limit');
		const clientLimit = await checkRateLimit('ip', clientIdentifier, 5);
		if (!clientLimit.success) {
			logger.warn('OTP client rate limit denied', { rateLimiterAvailable: clientLimit.available });
			return {
				success: false,
				reason: clientLimit.available ? 'rate_limited' : 'unavailable',
				error: clientLimit.available
					? 'Too many OTP requests from this client. Please try again later.'
					: 'OTP request protection is temporarily unavailable. Please try again.'
			};
		}
	}

	const normalizedEmail = email.toLowerCase().trim();
	const rateLimit = await checkOTPRateLimit(normalizedEmail);
	if (!rateLimit.allowed) {
		return {
			success: false,
			reason: rateLimit.available ? 'rate_limited' : 'unavailable',
			error: rateLimit.available
				? `Too many requests. Try again after ${rateLimit.resetAt?.toISOString()}`
				: 'OTP request protection is temporarily unavailable. Please try again.'
		};
	}

	const db = await getDatabase();
	for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
		const code = generateOTP();
		const token = createStoredToken(normalizedEmail, purpose, code);
		const existing = await db
			.select()
			.from(verificationTokens)
			.where(
				and(
					eq(verificationTokens.token, token),
					eq(verificationTokens.identifier, normalizedEmail),
					gt(verificationTokens.expires, new Date())
				)
			)
			.limit(1);
		if (existing.length > 0) continue;

		await db
			.update(verificationTokens)
			.set({ expires: new Date() })
			.where(
				and(
					eq(verificationTokens.identifier, normalizedEmail),
					eq(verificationTokens.purpose, purpose),
					gt(verificationTokens.expires, new Date())
				)
			);

		const result = await db
			.insert(verificationTokens)
			.values({
				identifier: normalizedEmail,
				token,
				expires: new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000),
				purpose,
				attemptCount: 0
			})
			.returning();

		if (result.length > 0) {
			return { success: true, code, remaining: rateLimit.remaining };
		}
	}

	return {
		success: false,
		reason: 'internal',
		error: 'Failed to generate unique OTP after collision retries'
	};
}

interface ValidateOTPTokenResult {
	success: boolean;
	valid: boolean;
	error?: string;
}

export async function validateOTPToken(
	email: string,
	code: string,
	clientIdentifier?: string
): Promise<ValidateOTPTokenResult> {
	const db = await getDatabase();
	const normalizedEmail = email.toLowerCase().trim();

	return db.transaction(async (tx) => {
		const now = new Date();
		const [token] = await tx
			.select()
			.from(verificationTokens)
			.where(
				and(
					eq(verificationTokens.identifier, normalizedEmail),
					eq(verificationTokens.purpose, 'authentication'),
					gt(verificationTokens.expires, now)
				)
			)
			.limit(1)
			.for('update');

		if (!token) return { success: false, valid: false, error: 'Invalid or expired OTP code' };
		const attemptCount = token.attemptCount ?? 0;
		if (attemptCount >= OTP_MAX_VALIDATION_ATTEMPTS) {
			await tx
				.update(verificationTokens)
				.set({ expires: now })
				.where(
					and(
						eq(verificationTokens.identifier, token.identifier),
						eq(verificationTokens.token, token.token)
					)
				);
			return { success: false, valid: false, error: 'Invalid or expired OTP code' };
		}

		if (!tokenMatches(token.token, normalizedEmail, 'authentication', code, clientIdentifier)) {
			const nextAttemptCount = attemptCount + 1;
			await tx
				.update(verificationTokens)
				.set(
					nextAttemptCount >= OTP_MAX_VALIDATION_ATTEMPTS
						? { attemptCount: nextAttemptCount, expires: now }
						: { attemptCount: nextAttemptCount }
				)
				.where(
					and(
						eq(verificationTokens.identifier, token.identifier),
						eq(verificationTokens.token, token.token)
					)
				);
			return { success: false, valid: false, error: 'Invalid or expired OTP code' };
		}

		const [consumed] = await tx
			.update(verificationTokens)
			.set({ expires: now })
			.where(
				and(
					eq(verificationTokens.identifier, token.identifier),
					eq(verificationTokens.token, token.token),
					gt(verificationTokens.expires, now)
				)
			)
			.returning({ token: verificationTokens.token });

		return consumed
			? { success: true, valid: true }
			: { success: false, valid: false, error: 'Invalid or expired OTP code' };
	});
}

export async function invalidateOTPTokens(email: string): Promise<void> {
	const db = await getDatabase();
	await db
		.update(verificationTokens)
		.set({ expires: new Date() })
		.where(
			and(
				eq(verificationTokens.identifier, email.toLowerCase().trim()),
				eq(verificationTokens.purpose, 'authentication'),
				gt(verificationTokens.expires, new Date())
			)
		);
}

interface CheckOTPRateLimitResult {
	allowed: boolean;
	available: boolean;
	remaining: number;
	resetAt?: Date;
}

export async function checkOTPRateLimit(email: string): Promise<CheckOTPRateLimitResult> {
	const { checkRateLimit } = await import('$lib/rate-limit');
	const result = await checkRateLimit('otp', email.toLowerCase().trim(), OTP_RATE_LIMIT_REQUESTS);
	return {
		allowed: result.success,
		available: result.available,
		remaining: result.remaining,
		resetAt: result.reset > 0 ? new Date(result.reset * 1000) : undefined
	};
}
