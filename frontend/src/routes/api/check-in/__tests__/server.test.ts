import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockTransaction = vi.fn();
const mockDb = {
	select: mockSelect,
	transaction: mockTransaction
};

const mockOperator = (type: string) =>
	vi.fn((...values: unknown[]) => ({
		type,
		values
	}));

vi.mock('$lib/server/capability-check-in-dependencies', () => ({
	capabilityCheckInDependencies: {
		and: mockOperator('and'),
		checkInTokens: {
			token: 'token',
			tokenVersion: 'token_version',
			id: 'id',
			secretId: 'secret_id',
			usedAt: 'used_at',
			expiresAt: 'expires_at'
		},
		checkinHistory: { secretId: 'secret_id' },
		checkRateLimit: vi.fn(async () => ({ success: true })),
		createRateLimitResponse: vi.fn(() => new Response(null, { status: 429 })),
		eq: mockOperator('eq'),
		fingerprintCapability: vi.fn(() => 'capability-fingerprint'),
		getClientIdentifier: vi.fn(() => '127.0.0.1'),
		getDatabase: vi.fn(async () => mockDb),
		gt: mockOperator('gt'),
		hashCheckInToken: vi.fn(() => 'stored-token-hash'),
		isNull: mockOperator('isNull'),
		ne: mockOperator('ne'),
		or: mockOperator('or'),
		scheduleRemindersForSecret: vi.fn(),
		secrets: {
			id: 'id',
			userId: 'user_id',
			title: 'title',
			checkInDays: 'check_in_days',
			bitcoinDeliveryStatus: 'bitcoin_delivery_status',
			status: 'status',
			triggeredAt: 'triggered_at'
		}
	}
}));

describe('POST /api/check-in logging', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.DATABASE_URL = 'postgres://test';
		mockLimit.mockResolvedValue([]);
	});

	it('does not consume a capability token when Bitcoin refresh is required', async () => {
		const token = 'super-secret-check-in-token-at-least-32-bytes';
		mockLimit
			.mockResolvedValueOnce([
				{
					id: 'token-id',
					secretId: 'secret-id',
					usedAt: null,
					expiresAt: new Date(Date.now() + 60_000)
				}
			])
			.mockResolvedValueOnce([
				{
					id: 'secret-id',
					userId: 'user-id',
					title: 'Bitcoin secret',
					checkInDays: 30,
					bitcoinDeliveryStatus: 'ready'
				}
			]);
		vi.spyOn(console, 'log').mockImplementation(() => {});

		const { POST } = await import('../+server');
		const response = await POST({
			url: new URL('http://localhost/api/check-in'),
			request: new Request('http://localhost/api/check-in', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token })
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: 'Refresh the Bitcoin continuity generation to complete this check-in'
		});
		expect(mockTransaction).not.toHaveBeenCalled();
	});

	it('does not log raw token-bearing URLs or token values, and uses a fingerprint instead', async () => {
		const token = 'super-secret-check-in-token-at-least-32-bytes';
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const { POST } = await import('../+server');
		const response = await POST({
			url: new URL('http://localhost/api/check-in'),
			request: new Request('http://localhost/api/check-in', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-forwarded-for': '203.0.113.10'
				},
				body: JSON.stringify({ token })
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
