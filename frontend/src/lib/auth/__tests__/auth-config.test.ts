import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let capturedConfig: Record<string, any>;

const mockSvelteKitAuth = vi.fn((config: Record<string, any>) => {
	capturedConfig = config;
	return {
		handle: vi.fn(),
		signIn: vi.fn(),
		signOut: vi.fn()
	};
});

const mockGoogle = vi.fn((options: Record<string, unknown>) => ({
	id: 'google',
	type: 'oauth',
	...options
}));

const mockCredentials = vi.fn((options: Record<string, unknown>) => ({
	id: 'credentials',
	type: 'credentials',
	...options
}));

vi.mock('@auth/sveltekit', () => ({
	SvelteKitAuth: (config: unknown) => mockSvelteKitAuth(config as Record<string, any>)
}));

vi.mock('@auth/sveltekit/providers/google', () => ({
	default: (options: Record<string, unknown>) => mockGoogle(options)
}));

vi.mock('@auth/sveltekit/providers/credentials', () => ({
	default: (options: Record<string, unknown>) => mockCredentials(options)
}));

const mockDbLimit = vi.fn();
const mockDbWhere = vi.fn(() => ({ limit: mockDbLimit }));
const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }));
const mockDbDeleteReturning = vi.fn();
const mockDbDeleteWhere = vi.fn(() => ({ returning: mockDbDeleteReturning }));
const mockDbDelete = vi.fn(() => ({ where: mockDbDeleteWhere }));
const mockGetDatabase = vi.fn(async () => ({ select: mockDbSelect, delete: mockDbDelete }));

vi.mock('$lib/db/drizzle', () => ({
	getDatabase: mockGetDatabase
}));

vi.mock('$lib/db/schema', () => ({
	users: {
		id: 'users.id',
		email: 'users.email',
		sessionsInvalidatedAt: 'users.sessions_invalidated_at',
		sessionVersion: 'users.session_version'
	},
	verificationTokens: { token: 'verification_tokens.token', identifier: 'verification_tokens.identifier' }
}));
vi.mock('$lib/auth/password', () => ({ validatePassword: vi.fn() }));
vi.mock('$lib/auth/users', () => ({ authenticateUser: vi.fn() }));
vi.mock('$lib/auth/otp', () => ({ validateOTPToken: vi.fn() }));
vi.mock('$lib/auth/privacy-policy', () => ({ recordPrivacyPolicyAcceptance: vi.fn() }));
vi.mock('$lib/services/audit-logger', () => ({
	logLogin: vi.fn(),
	logCheckIn: vi.fn(),
	logSubscriptionChanged: vi.fn()
}));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn(), gt: vi.fn(), lte: vi.fn() }));

describe('auth config', () => {
	beforeAll(async () => {
		process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
		process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

		await import('../../../auth');
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mockDbLimit.mockReset();
		mockDbWhere.mockClear();
		mockDbFrom.mockClear();
		mockDbSelect.mockClear();
		mockDbDeleteReturning.mockReset();
		mockDbDeleteWhere.mockReset();
		mockDbDelete.mockReset();
		mockDbDelete.mockImplementation(() => ({ where: mockDbDeleteWhere }));
		mockDbDeleteWhere.mockImplementation(() => ({ returning: mockDbDeleteReturning }));
		mockGetDatabase.mockClear();
	});

	it('passes GOOGLE_CLIENT_* env vars to the Google provider', () => {
		expect(capturedConfig.providers[0]).toEqual(
			expect.objectContaining({
				clientId: 'test-client.apps.googleusercontent.com',
				clientSecret: 'test-secret'
			})
		);
	});

	it('stores the current session version in the JWT during sign-in', async () => {
		mockDbLimit.mockResolvedValue([
			{
				id: 'user-1',
				emailVerified: new Date('2026-04-01T00:00:00.000Z'),
				isAdmin: true,
				sessionVersion: 3
			}
		]);

		const token = { sub: 'user-1' };
		const result = await capturedConfig.callbacks.jwt({
			token,
			user: { id: 'user-1' }
		});

		expect(result).toEqual({
			sub: 'user-1',
			id: 'user-1',
			emailVerified: new Date('2026-04-01T00:00:00.000Z'),
			isAdmin: true,
			sessionVersion: 3
		});
		expect(mockGetDatabase).toHaveBeenCalledOnce();
	});

	it('keeps a JWT valid when only updatedAt changed after token issuance', async () => {
		const issuedAt = Math.floor(new Date('2026-04-12T12:00:00.000Z').getTime() / 1000);

		mockDbLimit.mockResolvedValue([
			{
				id: 'user-1',
				updatedAt: new Date('2026-04-12T12:00:10.000Z'),
				sessionsInvalidatedAt: null,
				sessionVersion: 0,
				emailVerified: new Date('2026-04-01T00:00:00.000Z'),
				isAdmin: false
			}
		]);

		const token = { id: 'user-1', iat: issuedAt, sessionVersion: 0 };
		const result = await capturedConfig.callbacks.jwt({ token });

		expect(result).toEqual(token);
		expect(mockGetDatabase).toHaveBeenCalledOnce();
	});

	it('rejects a JWT when the database session version differs from the token session version', async () => {
		const issuedAt = Math.floor(new Date('2026-04-12T12:00:00.000Z').getTime() / 1000);

		mockDbLimit.mockResolvedValue([
			{
				id: 'user-1',
				updatedAt: new Date('2026-04-12T11:00:00.000Z'),
				sessionsInvalidatedAt: new Date('2026-04-12T12:00:10.000Z'),
				sessionVersion: 2,
				emailVerified: new Date('2026-04-01T00:00:00.000Z'),
				isAdmin: false
			}
		]);

		const token = { id: 'user-1', iat: issuedAt, sessionVersion: 1 };
		const result = await capturedConfig.callbacks.jwt({ token });

		expect(result).toBeNull();
		expect(mockGetDatabase).toHaveBeenCalledOnce();
	});

	it('keeps a JWT valid when the database session version matches the token session version', async () => {
		const issuedAt = Math.floor(new Date('2026-04-12T12:00:00.000Z').getTime() / 1000);

		mockDbLimit.mockResolvedValue([
			{
				id: 'user-1',
				updatedAt: new Date('2026-04-12T11:59:50.000Z'),
				sessionsInvalidatedAt: null,
				sessionVersion: 4,
				emailVerified: new Date('2026-04-01T00:00:00.000Z'),
				isAdmin: true
			}
		]);

		const token = { id: 'user-1', iat: issuedAt, isAdmin: false, sessionVersion: 4 };
		const result = await capturedConfig.callbacks.jwt({ token });

		expect(result).toEqual(token);
		expect(mockGetDatabase).toHaveBeenCalledOnce();
	});

	it('keeps a fresh JWT valid even when emailVerified is false', async () => {
		const issuedAt = Math.floor(new Date('2026-04-12T12:00:00.000Z').getTime() / 1000);

		mockDbLimit.mockResolvedValue([
			{
				id: 'user-1',
				updatedAt: new Date('2026-04-12T11:59:50.000Z'),
				sessionsInvalidatedAt: null,
				sessionVersion: 0,
				emailVerified: null,
				isAdmin: false
			}
		]);

		const token = { id: 'user-1', iat: issuedAt, sessionVersion: 0 };
		const result = await capturedConfig.callbacks.jwt({ token });

		expect(result).toEqual(token);
		expect(mockGetDatabase).toHaveBeenCalledOnce();
	});

	it('keeps a JWT valid when revocation happened in the same second but the session version still matches', async () => {
		const issuedAt = Math.floor(new Date('2026-04-12T12:00:00.000Z').getTime() / 1000);

		mockDbLimit.mockResolvedValue([
			{
				id: 'user-1',
				updatedAt: new Date('2026-04-12T12:00:00.900Z'),
				sessionsInvalidatedAt: new Date('2026-04-12T12:00:00.900Z'),
				sessionVersion: 7,
				emailVerified: new Date('2026-04-01T00:00:00.000Z'),
				isAdmin: false
			}
		]);

		const token = { id: 'user-1', iat: issuedAt, sessionVersion: 7 };
		const result = await capturedConfig.callbacks.jwt({ token });

		expect(result).toEqual(token);
		expect(mockGetDatabase).toHaveBeenCalledOnce();
	});

	it('rejects a JWT when the user record no longer exists', async () => {
		const issuedAt = Math.floor(new Date('2026-04-12T12:00:00.000Z').getTime() / 1000);

		mockDbLimit.mockResolvedValue([]);

		const token = { id: 'deleted-user', iat: issuedAt, sessionVersion: 0 };
		const result = await capturedConfig.callbacks.jwt({ token });

		expect(result).toBeNull();
		expect(mockGetDatabase).toHaveBeenCalledOnce();
	});

	it('rejects a JWT when the user lookup fails during session version validation', async () => {
		const issuedAt = Math.floor(new Date('2026-04-12T12:00:00.000Z').getTime() / 1000);
		const databaseError = new Error('database offline');

		mockGetDatabase.mockRejectedValueOnce(databaseError);

		const token = { id: 'user-1', iat: issuedAt, sessionVersion: 2, isAdmin: false };
		const result = await capturedConfig.callbacks.jwt({ token });

		expect(result).toBeNull();
		expect(mockGetDatabase).toHaveBeenCalledOnce();
	});

	it('uses the atomic verification token consumer for auto-login', async () => {
		mockDbLimit.mockResolvedValueOnce([
			{
				id: 'user-1',
				email: 'user@example.com',
				emailVerified: new Date('2026-04-01T00:00:00.000Z'),
				name: 'Test User',
				image: null
			}
		]);
		mockDbDeleteReturning.mockResolvedValueOnce([
			{
				identifier: 'user@example.com',
				purpose: 'email_verification_login',
				expires: new Date('2026-04-13T00:00:00.000Z')
			}
		]);

		const result = await capturedConfig.providers[1].authorize({
			verificationToken: 'raw-verification-token',
			userId: 'user-1'
		});

		expect(result).toEqual({
			id: 'user-1',
			email: 'user@example.com',
			name: 'Test User',
			image: null
		});
		expect(mockDbDelete).toHaveBeenCalledOnce();
		expect(mockDbDeleteWhere).toHaveBeenCalledOnce();
		expect(mockDbDeleteReturning).toHaveBeenCalledOnce();
	});
});
