import { beforeEach, describe, expect, it, vi } from 'vitest';

const verificationTokens = {
	identifier: 'verification_tokens.identifier',
	token: 'verification_tokens.token',
	expires: 'verification_tokens.expires',
	purpose: 'verification_tokens.purpose',
	attemptCount: 'verification_tokens.attempt_count'
};
const accountLockouts = { email: 'account_lockouts.email' };
const otpRateLimits = { email: 'otp_rate_limits.email' };

let activeTokens: Array<{
	identifier: string;
	token: string;
	expires: Date;
	purpose: 'authentication';
	attemptCount: number;
}> = [];
const updateSets: Array<Record<string, unknown>> = [];

const lockedSelect = {
	for: vi.fn(async () => activeTokens)
};
const limitedSelect = {
	for: lockedSelect.for
};
const whereSelect = {
	limit: vi.fn(() => limitedSelect)
};
const fromSelect = vi.fn((table: unknown) => {
	if (table !== verificationTokens) {
		throw new Error('OTP validation must not read account lockout state');
	}
	return { where: vi.fn(() => whereSelect) };
});
const select = vi.fn(() => ({ from: fromSelect }));
const whereUpdate = vi.fn(async () => []);
const setUpdate = vi.fn((values: Record<string, unknown>) => {
	updateSets.push(values);
	return { where: whereUpdate };
});
const update = vi.fn((table: unknown) => {
	if (table !== verificationTokens) {
		throw new Error('OTP validation must update only the active challenge');
	}
	return { set: setUpdate };
});
const tx = { select, update };
const transaction = vi.fn(async (callback: (transactionDb: typeof tx) => Promise<unknown>) =>
	callback(tx)
);

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: vi.fn(async () => ({ transaction }))
}));

vi.mock('$lib/db/schema', () => ({ verificationTokens, accountLockouts, otpRateLimits }));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
	and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
	gt: vi.fn((...args: unknown[]) => ({ type: 'gt', args })),
	lt: vi.fn((...args: unknown[]) => ({ type: 'lt', args }))
}));

vi.mock('$lib/logger', () => ({
	logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
}));

import { validateOTPToken } from '$lib/auth/otp';

describe('validateOTPToken', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		activeTokens = [];
		updateSets.length = 0;
	});

	it('does not mutate durable account state when no active challenge exists', async () => {
		const result = await validateOTPToken('victim@example.com', '00000000');

		expect(result).toEqual({ success: false, valid: false, error: 'Invalid or expired OTP code' });
		expect(update).not.toHaveBeenCalled();
	});

	it('increments only the active challenge for an invalid code', async () => {
		activeTokens = [
			{
				identifier: 'victim@example.com',
				token: '12345678',
				expires: new Date(Date.now() + 60_000),
				purpose: 'authentication',
				attemptCount: 1
			}
		];

		const result = await validateOTPToken('victim@example.com', '00000000');

		expect(result.valid).toBe(false);
		expect(updateSets).toEqual([expect.objectContaining({ attemptCount: 2 })]);
	});

	it('expires an exhausted challenge without permanently locking the account', async () => {
		activeTokens = [
			{
				identifier: 'victim@example.com',
				token: '12345678',
				expires: new Date(Date.now() + 60_000),
				purpose: 'authentication',
				attemptCount: 4
			}
		];

		const result = await validateOTPToken('victim@example.com', '00000000');

		expect(result.valid).toBe(false);
		expect(updateSets[0]).toEqual(
			expect.objectContaining({ attemptCount: 5, expires: expect.any(Date) })
		);
	});

	it('consumes the matching active challenge exactly once', async () => {
		activeTokens = [
			{
				identifier: 'owner@example.com',
				token: '12345678',
				expires: new Date(Date.now() + 60_000),
				purpose: 'authentication',
				attemptCount: 0
			}
		];

		const result = await validateOTPToken('owner@example.com', '12345678');

		expect(result).toEqual({ success: true, valid: true });
		expect(updateSets).toEqual([expect.objectContaining({ expires: expect.any(Date) })]);
	});
});
