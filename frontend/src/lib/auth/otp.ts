import { getDatabase } from '$lib/db/drizzle';
import { verificationTokens } from '$lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { timingSafeStringEqual } from '$lib/crypto/timing-safe';
import { logger } from '$lib/logger';

const OTP_EXPIRATION_MINUTES = 5;
const OTP_MAX_VALIDATION_ATTEMPTS = 5;
const MAX_COLLISION_RETRIES = 3;

const isProduction = process.env.NODE_ENV === 'production';
const OTP_RATE_LIMIT_REQUESTS = isProduction ? 3 : 10;

export function generateOTP(): string {
	const code = crypto.randomInt(0, 100000000);
	return code.toString().padStart(8, '0');
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
	ipAddress?: string
): Promise<CreateOTPTokenResult> {
	// Check IP-based rate limit first (5 requests per minute per IP)
	if (ipAddress) {
		const { checkRateLimit } = await import('$lib/rate-limit');
		const ipRateLimit = await checkRateLimit('ip', ipAddress, 5);

		if (!ipRateLimit.success) {
			logger.warn('OTP IP rate limit denied', { rateLimiterAvailable: ipRateLimit.available });
			return {
				success: false,
				reason: ipRateLimit.available ? 'rate_limited' : 'unavailable',
				error: ipRateLimit.available
					? 'Too many OTP requests from this IP address. Please try again later.'
					: 'OTP request protection is temporarily unavailable. Please try again.'
			};
		}
	}

	// Check email-based rate limit
	const rateLimit = await checkOTPRateLimit(email);
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

	for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
		const code = generateOTP();

		const existing = await db
			.select()
			.from(verificationTokens)
			.where(
				and(
					eq(verificationTokens.token, code),
					eq(verificationTokens.identifier, email),
					gt(verificationTokens.expires, new Date())
				)
			)
			.limit(1);

		if (existing.length > 0) {
			continue;
		}

		await db
			.update(verificationTokens)
			.set({ expires: new Date() })
			.where(
				and(
					eq(verificationTokens.identifier, email),
					eq(verificationTokens.purpose, purpose),
					gt(verificationTokens.expires, new Date())
				)
			);

		const expires = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);
		const result = await db
			.insert(verificationTokens)
			.values({
				identifier: email,
				token: code,
				expires,
				purpose,
				attemptCount: 0
			})
			.returning();

		if (result.length > 0) {
			return {
				success: true,
				code,
				remaining: rateLimit.remaining
			};
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
	code: string
): Promise<ValidateOTPTokenResult> {
	const db = await getDatabase();

	return await db.transaction(async (tx) => {
		const now = new Date();
		const [token] = await tx
			.select()
			.from(verificationTokens)
			.where(
				and(
					eq(verificationTokens.identifier, email),
					eq(verificationTokens.purpose, 'authentication'),
					gt(verificationTokens.expires, now)
				)
			)
			.limit(1)
			.for('update');

		if (!token) {
			return {
				success: false,
				valid: false,
				error: 'Invalid or expired OTP code'
			};
		}

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
			return {
				success: false,
				valid: false,
				error: 'Invalid or expired OTP code'
			};
		}

		if (!timingSafeStringEqual(token.token, code)) {
			const nextAttemptCount = attemptCount + 1;
			const updates =
				nextAttemptCount >= OTP_MAX_VALIDATION_ATTEMPTS
					? { attemptCount: nextAttemptCount, expires: now }
					: { attemptCount: nextAttemptCount };

			await tx
				.update(verificationTokens)
				.set(updates)
				.where(
					and(
						eq(verificationTokens.identifier, token.identifier),
						eq(verificationTokens.token, token.token)
					)
				);

			return {
				success: false,
				valid: false,
				error: 'Invalid or expired OTP code'
			};
		}

		await tx
			.update(verificationTokens)
			.set({ expires: now })
			.where(
				and(
					eq(verificationTokens.identifier, token.identifier),
					eq(verificationTokens.token, token.token),
					gt(verificationTokens.expires, now)
				)
			);

		return {
			success: true,
			valid: true
		};
	});
}

export async function invalidateOTPTokens(email: string): Promise<void> {
	const db = await getDatabase();

	await db
		.update(verificationTokens)
		.set({ expires: new Date() })
		.where(
			and(
				eq(verificationTokens.identifier, email),
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
