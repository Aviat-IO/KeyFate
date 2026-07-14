import { isIP } from 'node:net';
import { checkRateLimitDB, type RateLimitResult, type RateLimitType } from '$lib/rate-limit-db';

export type { RateLimitType } from '$lib/rate-limit-db';

const RATE_LIMIT_WINDOWS = {
	ip: 60 * 1000, // 1 minute
	user: 60 * 1000, // 1 minute
	checkIn: 60 * 60 * 1000, // 1 hour
	secretCreation: 60 * 60 * 1000, // 1 hour
	otp: 60 * 60 * 1000, // 1 hour
	registration: 60 * 60 * 1000, // 1 hour
	'verify-email': 15 * 60 * 1000,
	'resend-verification': 60 * 60 * 1000,
	'request-password-reset': 60 * 60 * 1000,
	'reset-password-attempt': 60 * 60 * 1000
};

export async function checkRateLimit(
	type: RateLimitType,
	identifier: string,
	limit: number
): Promise<RateLimitResult> {
	const windowMs = RATE_LIMIT_WINDOWS[type];
	return checkRateLimitDB(type, identifier, limit, windowMs);
}

export function getRateLimitHeaders(result: RateLimitResult) {
	return {
		'X-RateLimit-Limit': result.limit.toString(),
		'X-RateLimit-Remaining': result.remaining.toString(),
		'X-RateLimit-Reset': result.reset.toString()
	};
}

export function getClientIdentifier(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	const forwardedChain = forwarded
		?.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
	const attested = forwardedChain?.at(-1);
	if (attested && attested.length <= 45 && isIP(attested)) return attested;

	if (process.env.NODE_ENV !== 'production') {
		const realIp = request.headers.get('x-real-ip')?.trim();
		if (realIp && realIp.length <= 45 && isIP(realIp)) return realIp;
	}

	return 'unknown';
}

export function createRateLimitResponse(result: RateLimitResult): Response {
	const retryAfter = Math.max(1, result.reset - Math.floor(Date.now() / 1000));
	const unavailable = !result.available || result.reason === 'unavailable';

	return new Response(
		JSON.stringify({
			error: unavailable
				? 'Request protection is temporarily unavailable. Please try again.'
				: 'Too many requests. Please try again later.',
			retryAfter
		}),
		{
			status: unavailable ? 503 : 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': retryAfter.toString(),
				...getRateLimitHeaders(result)
			}
		}
	);
}
