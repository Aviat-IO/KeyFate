import { beforeEach, describe, expect, it, vi } from 'vitest';

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));
const mockDeleteReturning = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockSelectFor = vi.fn();
const mockSelectLimit = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit, for: mockSelectFor }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));
const mockGetDatabase = vi.fn(async () => ({
	delete: mockDelete,
	insert: mockInsert,
	select: mockSelect
}));

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: mockGetDatabase
}));

vi.mock('$lib/db/schema', () => ({
	users: {
		email: 'users.email',
		emailVerified: 'users.email_verified'
	},
	verificationTokens: {
		identifier: 'verification_tokens.identifier',
		token: 'verification_tokens.token',
		expires: 'verification_tokens.expires',
		purpose: 'verification_tokens.purpose'
	}
}));

vi.mock('drizzle-orm', () => ({
	and: vi.fn((...args: unknown[]) => args),
	eq: vi.fn((...args: unknown[]) => args),
	gt: vi.fn((...args: unknown[]) => args),
	lte: vi.fn((...args: unknown[]) => args)
}));

import {
	consumeVerificationToken,
	deleteVerificationTokenById,
	createAutoLoginToken,
	createVerificationToken,
	getConsumableVerificationToken
} from '../email-verification';

type ConsumeVerificationTokenPurpose = Parameters<typeof consumeVerificationToken>[0]['purpose'];
type ConsumeVerificationTokenPurposeIsNarrow = Assert<
	Equal<ConsumeVerificationTokenPurpose, 'email_verification' | 'email_verification_login'>
>;

describe('email verification token storage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDeleteWhere.mockReset();
		mockDelete.mockImplementation(() => ({ where: mockDeleteWhere }));
		mockSelectFor.mockReset();
		mockSelectLimit.mockResolvedValue([
			{
				id: 'user-1',
				email: 'user@example.com',
				emailVerified: null
			}
		]);
	});

	it('stores a hashed verification token while returning the raw token', async () => {
		const result = await createVerificationToken('user@example.com');

		expect(result.success).toBe(true);
		expect(result.token).toMatch(/^[a-f0-9]{64}$/);
		expect(mockInsertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				identifier: 'user@example.com',
				token: expect.stringMatching(/^[a-f0-9]{64}$/)
			})
		);

		const insertedToken = mockInsertValues.mock.calls[0][0].token;
		expect(insertedToken).not.toBe(result.token);
	});

	it('stores auto-login tokens hashed at rest with a dedicated purpose', async () => {
		const token = await createAutoLoginToken('user@example.com');

		expect(token).toMatch(/^[a-f0-9]{64}$/);
		expect(mockInsertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				identifier: 'user@example.com',
				purpose: 'email_verification_login',
				token: expect.stringMatching(/^[a-f0-9]{64}$/)
			})
		);
		expect(mockInsertValues.mock.calls[0][0].token).not.toBe(token);
	});

	it('atomically consumes a verification token using email, hash, and purpose', async () => {
		mockDeleteWhere.mockReturnValueOnce({ returning: mockDeleteReturning });
		mockDeleteReturning.mockResolvedValueOnce([
			{
				identifier: 'user@example.com',
				purpose: 'email_verification_login',
				expires: new Date(Date.now() + 60_000)
			}
		]);

		const result = await consumeVerificationToken({
			email: 'user@example.com',
			token: 'raw-verification-token',
			purpose: 'email_verification_login'
		});

		expect(result).toEqual({
			success: true,
			consumed: expect.objectContaining({ identifier: 'user@example.com' })
		});
		expect(mockSelect).not.toHaveBeenCalled();
		expect(mockDeleteReturning).toHaveBeenCalledOnce();
	});

	it('only exposes hashed-token purposes in the consume helper contract', () => {
		expect<ConsumeVerificationTokenPurposeIsNarrow>(true).toBe(true);
	});

	it('locks and validates a verification token without deleting it first', async () => {
		mockSelectFor.mockResolvedValueOnce([
			{
				identifier: 'user@example.com',
				expires: new Date(Date.now() + 60_000),
				purpose: 'email_verification'
			}
		]);

		const result = await getConsumableVerificationToken(
			{ select: mockSelect, delete: mockDelete },
			{
				email: 'user@example.com',
				token: 'raw-verification-token',
				purpose: 'email_verification'
			}
		);

		expect(result).toEqual({
			success: true,
			consumed: expect.objectContaining({
				identifier: 'user@example.com',
				purpose: 'email_verification'
			})
		});
		expect(mockDeleteWhere).not.toHaveBeenCalled();
	});

	it('only deletes a verification token when the explicit delete helper is called', async () => {
		await deleteVerificationTokenById(
			{ delete: mockDelete },
			{
				email: 'user@example.com',
				token: 'raw-verification-token',
				purpose: 'email_verification'
			}
		);

		expect(mockDeleteWhere).toHaveBeenCalledOnce();
	});
});
