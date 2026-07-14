import { checkRateLimit as checkSharedRateLimit, type RateLimitType } from '$lib/rate-limit';
import { cleanupExpiredRateLimits as cleanupSharedRateLimits } from '$lib/rate-limit-db';
import { rateLimits } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

interface RateLimitResult {
	allowed: boolean;
	available: boolean;
	remaining: number;
	resetTime: Date;
	retryAfter?: number;
}

interface RateLimitConfig {
	maxAttempts: number;
	windowMs: number;
}

type AuthRateLimitOperation =
	| 'verify-email'
	| 'resend-verification'
	| 'request-password-reset'
	| 'reset-password-attempt';

const RATE_LIMIT_CONFIGS: Record<AuthRateLimitOperation, RateLimitConfig> = {
	'verify-email': {
		maxAttempts: 5,
		windowMs: 15 * 60 * 1000
	},
	'resend-verification': {
		maxAttempts: 3,
		windowMs: 60 * 60 * 1000
	},
	'request-password-reset': {
		maxAttempts: 3,
		windowMs: 60 * 60 * 1000
	},
	'reset-password-attempt': {
		maxAttempts: 5,
		windowMs: 60 * 60 * 1000
	}
};

function isAuthRateLimitOperation(operation: string): operation is AuthRateLimitOperation {
	return Object.prototype.hasOwnProperty.call(RATE_LIMIT_CONFIGS, operation);
}

export function getRateLimitConfig(operation: string): RateLimitConfig {
	if (!isAuthRateLimitOperation(operation)) {
		throw new Error(`Unknown rate limit operation: ${operation}`);
	}
	return RATE_LIMIT_CONFIGS[operation];
}

function normalizeIdentifier(identifier: string): string {
	return identifier.toLowerCase().trim();
}

export async function checkRateLimit(
	operation: string,
	identifier: string
): Promise<RateLimitResult> {
	const config = getRateLimitConfig(operation);
	const result = await checkSharedRateLimit(
		operation as RateLimitType,
		normalizeIdentifier(identifier),
		config.maxAttempts
	);
	const resetTime = new Date(result.reset * 1000);
	const retryAfter = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));

	return {
		allowed: result.success,
		available: result.available,
		remaining: result.remaining,
		resetTime,
		retryAfter: result.success ? undefined : retryAfter
	};
}

export async function clearRateLimit(operation: string, identifier: string): Promise<void> {
	getRateLimitConfig(operation);
	const { getDatabase } = await import('$lib/db/drizzle');
	const db = await getDatabase();
	const key = `${operation}:${normalizeIdentifier(identifier)}`;
	await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

export async function cleanupExpiredRateLimits(): Promise<number> {
	return cleanupSharedRateLimits();
}
