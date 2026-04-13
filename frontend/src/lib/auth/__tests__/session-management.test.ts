import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockUpdate = vi.fn(() => ({
	set: mockSet
}));
const mockGetDatabase = vi.fn(async () => ({
	update: mockUpdate
}));

const mockInfo = vi.fn();
const mockError = vi.fn();

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: mockGetDatabase
}));

vi.mock('$lib/db/schema', () => ({
	users: {
		id: 'users.id',
		sessionsInvalidatedAt: 'users.sessions_invalidated_at',
		updatedAt: 'users.updated_at',
		sessionVersion: 'users.session_version'
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => Symbol('eq')),
	sql: vi.fn(() => Symbol('sql'))
}));

vi.mock('$lib/logger', () => ({
	logger: {
		info: mockInfo,
		error: mockError
	}
}));

import { invalidateAllUserSessions, SessionInvalidationReason } from '../session-management';

describe('invalidateAllUserSessions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSet.mockReturnValue({ where: mockWhere });
	});

	it('increments the dedicated session version when invalidating sessions', async () => {
		await invalidateAllUserSessions('user-1', SessionInvalidationReason.USER_REQUEST);

		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionsInvalidatedAt: expect.any(Date),
				sessionVersion: expect.anything()
			})
		);
		expect(mockSet).not.toHaveBeenCalledWith(expect.objectContaining({ updatedAt: expect.any(Date) }));
	});
});
