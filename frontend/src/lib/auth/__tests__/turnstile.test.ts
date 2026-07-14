import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from '$lib/auth/turnstile';

describe('Turnstile verification', () => {
	const originalEnvironment = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnvironment };
		vi.restoreAllMocks();
	});

	it('requires success, hostname, and action bindings', async () => {
		process.env.NODE_ENV = 'production';
		process.env.TURNSTILE_SECRET_KEY = 'secret';
		const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			void input;
			void init;
			return new Response(
				JSON.stringify({
					success: true,
					hostname: 'keyfate.example',
					action: 'request-otp'
				}),
				{ status: 200 }
			);
		});

		expect(
			await verifyTurnstileToken('response', {
				expectedHostname: 'keyfate.example',
				expectedAction: 'request-otp',
				remoteIp: '203.0.113.10',
				fetchImplementation: fetchImplementation as unknown as typeof fetch
			})
		).toBe(true);
		expect(fetchImplementation).toHaveBeenCalledOnce();
		expect(String(fetchImplementation.mock.calls[0]?.[1]?.body)).toContain('remoteip=203.0.113.10');
	});

	it.each([
		[{ success: true, hostname: 'evil.example', action: 'request-otp' }],
		[{ success: true, hostname: 'keyfate.example', action: 'other-action' }],
		[{ success: false, hostname: 'keyfate.example', action: 'request-otp' }]
	])('rejects an invalid binding %#', async (payload) => {
		process.env.NODE_ENV = 'production';
		process.env.TURNSTILE_SECRET_KEY = 'secret';
		expect(
			await verifyTurnstileToken('response', {
				expectedHostname: 'keyfate.example',
				fetchImplementation: (async () =>
					new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch
			})
		).toBe(false);
	});

	it('allows the bypass token only in development without a configured secret', async () => {
		process.env.NODE_ENV = 'development';
		delete process.env.TURNSTILE_SECRET_KEY;
		expect(await verifyTurnstileToken('dev-bypass-token')).toBe(true);
		process.env.NODE_ENV = 'production';
		expect(await verifyTurnstileToken('dev-bypass-token')).toBe(false);
	});
});
