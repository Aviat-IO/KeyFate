import { beforeAll, describe, expect, it, vi } from 'vitest';

const mockSvelteKitAuth = vi.fn(() => ({
	handle: vi.fn(),
	signIn: vi.fn(),
	signOut: vi.fn()
}));

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
	SvelteKitAuth: (config: unknown) => mockSvelteKitAuth(config)
}));

vi.mock('@auth/sveltekit/providers/google', () => ({
	default: (options: Record<string, unknown>) => mockGoogle(options)
}));

vi.mock('@auth/sveltekit/providers/credentials', () => ({
	default: (options: Record<string, unknown>) => mockCredentials(options)
}));

vi.mock('$lib/db/drizzle', () => ({ getDatabase: vi.fn() }));
vi.mock('$lib/db/schema', () => ({ users: {}, verificationTokens: {} }));
vi.mock('$lib/auth/password', () => ({ validatePassword: vi.fn() }));
vi.mock('$lib/auth/users', () => ({ authenticateUser: vi.fn() }));
vi.mock('$lib/auth/otp', () => ({ validateOTPToken: vi.fn() }));
vi.mock('$lib/auth/privacy-policy', () => ({ recordPrivacyPolicyAcceptance: vi.fn() }));
vi.mock('$lib/services/audit-logger', () => ({ logLogin: vi.fn() }));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn(), gt: vi.fn() }));

describe('auth config', () => {
	beforeAll(async () => {
		process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
		process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

		await import('../../../auth');
	});

	it('passes GOOGLE_CLIENT_* env vars to the Google provider', () => {
		expect(mockGoogle).toHaveBeenCalledWith(
			expect.objectContaining({
				clientId: 'test-client.apps.googleusercontent.com',
				clientSecret: 'test-secret'
			})
		);
	});
});
