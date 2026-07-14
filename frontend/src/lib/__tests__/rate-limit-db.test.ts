import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReturning = vi.fn();
const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockDb = { insert: mockInsert };

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: vi.fn(async () => mockDb)
}));

vi.mock('$lib/db/schema', () => ({
	rateLimits: {
		key: 'rate_limits.key',
		count: 'rate_limits.count',
		expiresAt: 'rate_limits.expires_at'
	}
}));

vi.mock('drizzle-orm', () => ({
	sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })
}));

import { checkRateLimitDB } from '$lib/rate-limit-db';
import { rateLimits } from '$lib/db/schema';

describe('checkRateLimitDB', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('uses one insert/upsert decision and returns the committed count', async () => {
		const expiresAt = new Date(Date.now() + 60_000);
		mockReturning.mockResolvedValue([{ count: 3, expiresAt }]);

		const result = await checkRateLimitDB('user', 'user-1', 5, 60_000);

		expect(mockInsert).toHaveBeenCalledWith(rateLimits);
		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({ key: 'user:user-1', count: 1 })
		);
		expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			success: true,
			available: true,
			reason: undefined,
			limit: 5,
			remaining: 2,
			reset: Math.ceil(expiresAt.getTime() / 1000)
		});
	});

	it('denies when the atomically committed count exceeds the limit', async () => {
		const expiresAt = new Date(Date.now() + 60_000);
		mockReturning.mockResolvedValue([{ count: 6, expiresAt }]);

		const result = await checkRateLimitDB('ip', '203.0.113.7', 5, 60_000);

		expect(result.success).toBe(false);
		expect(result.available).toBe(true);
		expect(result.reason).toBe('limit');
		expect(result.remaining).toBe(0);
	});

	it('fails closed when PostgreSQL cannot make the decision', async () => {
		mockReturning.mockRejectedValue(new Error('database unavailable'));

		const result = await checkRateLimitDB('registration', '203.0.113.8', 5, 60_000);

		expect(result.success).toBe(false);
		expect(result.available).toBe(false);
		expect(result.reason).toBe('unavailable');
		expect(result.remaining).toBe(0);
		expect(result.reset).toBeGreaterThan(0);
	});
});
