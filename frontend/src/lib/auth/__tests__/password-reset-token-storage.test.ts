import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const mockEq = vi.fn((column: unknown, value: unknown) => ({ column, value }));

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: mockGetDatabase
}));

vi.mock('$lib/db/schema', () => ({
	passwordResetTokens: {
		id: 'password_reset_tokens.id',
		userId: 'password_reset_tokens.user_id',
		token: 'password_reset_tokens.token'
	},
	users: {
		email: 'users.email',
		password: 'users.password',
		emailVerified: 'users.email_verified'
	}
}));

vi.mock('drizzle-orm', () => ({
	and: vi.fn((...args: unknown[]) => args),
	eq: mockEq,
	gt: vi.fn((...args: unknown[]) => args)
}));

import {
	consumePasswordResetToken,
	deletePasswordResetTokenById,
	deletePasswordResetToken,
	generatePasswordResetToken,
	getConsumablePasswordResetToken,
	validatePasswordResetToken
} from '../password-reset';

describe('password reset token storage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDeleteWhere.mockReset();
		mockDelete.mockImplementation(() => ({ where: mockDeleteWhere }));
		mockSelectFor.mockReset();
	});

	it('stores a hashed password reset token while returning the raw token', async () => {
		const token = await generatePasswordResetToken('user-1');

		expect(token).toMatch(/^[a-f0-9]{64}$/);
		expect(mockInsertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				token: expect.stringMatching(/^[a-f0-9]{64}$/)
			})
		);

		const insertedToken = mockInsertValues.mock.calls[0][0].token;
		expect(insertedToken).not.toBe(token);
	});

	it('validates a raw password reset token against its stored hash', async () => {
		mockSelectLimit.mockResolvedValueOnce([
			{
				id: 'reset-1',
				userId: 'user-1',
				expires: new Date(Date.now() + 60_000)
			}
		]);

		const result = await validatePasswordResetToken('raw-reset-token');

		expect(result).toEqual({ isValid: true, userId: 'user-1' });
		expect(mockEq).toHaveBeenCalledWith(
			'password_reset_tokens.token',
			expect.not.stringContaining('raw-reset-token')
		);
	});

	it('deletes a password reset token using the presented raw token', async () => {
		await deletePasswordResetToken('raw-reset-token');

		expect(mockEq).toHaveBeenCalledWith(
			'password_reset_tokens.token',
			expect.not.stringContaining('raw-reset-token')
		);
	});

	it('atomically consumes a valid password reset token in one delete statement', async () => {
		mockDeleteWhere.mockReturnValueOnce({ returning: mockDeleteReturning });
		mockDeleteReturning.mockResolvedValueOnce([
			{
				id: 'reset-1',
				userId: 'user-1',
				expires: new Date(Date.now() + 60_000)
			}
		]);

		const result = await consumePasswordResetToken('raw-reset-token');

		expect(result).toEqual({ isValid: true, userId: 'user-1' });
		expect(mockSelect).not.toHaveBeenCalled();
		expect(mockDeleteReturning).toHaveBeenCalledOnce();
	});

	it('locks and validates a password reset token without deleting it first', async () => {
		mockSelectFor.mockResolvedValueOnce([
			{
				id: 'reset-1',
				userId: 'user-1',
				expires: new Date(Date.now() + 60_000)
			}
		]);

		const result = await getConsumablePasswordResetToken(
			{ select: mockSelect, delete: mockDelete },
			'raw-reset-token'
		);

		expect(result).toEqual({ isValid: true, userId: 'user-1', tokenId: 'reset-1' });
		expect(mockDeleteWhere).not.toHaveBeenCalled();
	});

	it('only deletes a password reset token when the explicit delete helper is called', async () => {
		await deletePasswordResetTokenById({ delete: mockDelete }, 'reset-1');

		expect(mockEq).toHaveBeenCalledWith('password_reset_tokens.id', 'reset-1');
		expect(mockDeleteWhere).toHaveBeenCalledOnce();
	});
});
