import { logger } from '$lib/logger';

const VERIFY_TIMEOUT_MS = 5_000;

interface TurnstileVerificationResponse {
	success?: boolean;
	hostname?: string;
	action?: string;
	'error-codes'?: string[];
}

export interface TurnstileVerificationOptions {
	expectedHostname?: string;
	expectedAction?: string;
	remoteIp?: string;
	fetchImplementation?: typeof fetch;
}

function configuredHostname(): string | undefined {
	const value = process.env.ORIGIN || process.env.PUBLIC_SITE_URL;
	if (!value) return undefined;
	try {
		return new URL(value).hostname;
	} catch {
		return undefined;
	}
}

export async function verifyTurnstileToken(
	token: string,
	options: TurnstileVerificationOptions = {}
): Promise<boolean> {
	const secretKey = process.env.TURNSTILE_SECRET_KEY;
	const isDevelopment = process.env.NODE_ENV === 'development';

	if (isDevelopment && !secretKey) return token === 'dev-bypass-token';
	if (!secretKey || !token || token === 'dev-bypass-token') return false;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
	try {
		const body = new URLSearchParams({ secret: secretKey, response: token });
		if (options.remoteIp && options.remoteIp !== 'unknown') body.set('remoteip', options.remoteIp);
		const response = await (options.fetchImplementation ?? fetch)(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body,
				signal: controller.signal
			}
		);
		if (!response.ok) return false;

		const result = (await response.json()) as TurnstileVerificationResponse;
		const expectedHostname = options.expectedHostname ?? configuredHostname();
		const expectedAction = options.expectedAction ?? 'request-otp';
		return (
			result.success === true &&
			Boolean(expectedHostname) &&
			result.hostname === expectedHostname &&
			result.action === expectedAction
		);
	} catch (error) {
		logger.warn('Turnstile verification failed', {
			timedOut: controller.signal.aborted,
			errorType: error instanceof Error ? error.name : 'unknown'
		});
		return false;
	} finally {
		clearTimeout(timeout);
	}
}
