import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, init?: { status?: number; headers?: HeadersInit }) =>
		new Response(JSON.stringify(data), {
			status: init?.status ?? 200,
			headers: {
				'Content-Type': 'application/json',
				...(init?.headers ?? {})
			}
		}),
	redirect: vi.fn(),
	error: vi.fn()
}));

const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockDb = {
	select: mockSelect
};

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: vi.fn(async () => mockDb)
}));

vi.mock('$lib/db/schema', () => ({
	checkInTokens: { token: 'token', id: 'id', secretId: 'secret_id' },
	secrets: { id: 'id' },
	checkinHistory: { secretId: 'secret_id' }
}));

vi.mock('$lib/services/reminder-scheduler', () => ({
	scheduleRemindersForSecret: vi.fn()
}));

vi.mock('$lib/rate-limit', () => ({
	checkRateLimit: vi.fn(async () => ({ success: true })),
	getRateLimitHeaders: vi.fn(() => ({})),
	getClientIdentifier: vi.fn(() => '127.0.0.1')
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((left, right) => ({ left, right }))
}));

describe('POST /api/check-in logging', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.DATABASE_URL = 'postgres://test';
		mockLimit.mockResolvedValue([]);
	});

	it('does not log raw token-bearing URLs or token values, and uses a fingerprint instead', async () => {
		const token = 'super-secret-check-in-token';
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const { POST } = await import('../+server');
		const response = await POST({
			url: new URL(`http://localhost/api/check-in?token=${token}`),
			request: new Request(`http://localhost/api/check-in?token=${token}`, {
				method: 'POST',
				headers: {
					'x-forwarded-for': '203.0.113.10'
				}
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);

		const renderedLogs = [...logSpy.mock.calls, ...warnSpy.mock.calls]
			.flat()
			.map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
			.join(' ');

		expect(renderedLogs).not.toContain(token);
		expect(renderedLogs).not.toContain(`token=${token}`);

		const invalidAttemptCall = warnSpy.mock.calls.find(
			([message]) => message === '[CHECK-IN] Invalid token attempt'
		);
		expect(invalidAttemptCall?.[1]).toEqual(
			expect.objectContaining({
				tokenFingerprint: expect.any(String)
			})
		);
		expect(invalidAttemptCall?.[1]).not.toHaveProperty('tokenPrefix');
	});
});
