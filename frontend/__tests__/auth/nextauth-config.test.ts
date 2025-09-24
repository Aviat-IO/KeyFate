import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the config
vi.mock('@/lib/auth/oauth-config-validator', () => ({
  assertValidOAuthConfig: vi.fn(),
}));

vi.mock('@/lib/auth/users', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/auth/password', () => ({
  validatePassword: vi.fn(),
}));

// Mock environment variables
const mockEnv = {
  NODE_ENV: 'test',
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  NEXTAUTH_SECRET: 'test-secret',
  NEXTAUTH_URL: 'http://localhost:3000',
};

describe('NextAuth Configuration - Email Provider Removed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    Object.keys(mockEnv).forEach(key => {
      process.env[key] = mockEnv[key as keyof typeof mockEnv];
    });
  });

  it('should not include EmailProvider in providers array', async () => {
    // Import after mocking
    const { authConfig } = await import('@/lib/auth-config');

    expect(authConfig.providers).toBeDefined();
    expect(Array.isArray(authConfig.providers)).toBe(true);

    // Check that no provider has type 'email'
    const hasEmailProvider = authConfig.providers.some((provider: any) =>
      provider.id === 'email' || provider.type === 'email'
    );
    expect(hasEmailProvider).toBe(false);
  });

  it('should include GoogleProvider when properly configured', async () => {
    const { authConfig } = await import('@/lib/auth-config');

    // Should have Google provider
    const hasGoogleProvider = authConfig.providers.some((provider: any) =>
      provider.id === 'google'
    );
    expect(hasGoogleProvider).toBe(true);
  });

  it('should include CredentialsProvider', async () => {
    const { authConfig } = await import('@/lib/auth-config');

    // Should have credentials provider
    const hasCredentialsProvider = authConfig.providers.some((provider: any) =>
      provider.id === 'credentials'
    );
    expect(hasCredentialsProvider).toBe(true);
  });

  it('should not include GoogleProvider when not properly configured', async () => {
    // Remove Google configuration
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    // Re-import to get new config
    vi.resetModules();
    const { authConfig } = await import('@/lib/auth-config');

    const hasGoogleProvider = authConfig.providers.some((provider: any) =>
      provider.id === 'google'
    );
    expect(hasGoogleProvider).toBe(false);
  });

  it('should have correct pages configuration', async () => {
    const { authConfig } = await import('@/lib/auth-config');

    expect(authConfig.pages).toEqual({
      signIn: "/sign-in",
      // error page intentionally omitted to prevent automatic redirects
    });
  });

  it('should not have email provider callback in signIn callback', async () => {
    const { authConfig } = await import('@/lib/auth-config');

    // Test signIn callback
    const mockAccount = { provider: 'email' };
    const mockProfile = {};

    const result = await authConfig.callbacks?.signIn?.({
      account: mockAccount as any,
      profile: mockProfile
    });

    // Should return false for email provider (not supported)
    expect(result).toBe(false);
  });

  it('should allow Google provider in signIn callback', async () => {
    const { authConfig } = await import('@/lib/auth-config');

    // Test signIn callback for Google
    const mockAccount = { provider: 'google' };
    const mockProfile = {
      email: 'test@example.com',
      email_verified: true
    };

    const result = await authConfig.callbacks?.signIn?.({
      account: mockAccount as any,
      profile: mockProfile
    });

    expect(result).toBe(true);
  });

  it('should allow credentials provider in signIn callback', async () => {
    const { authConfig } = await import('@/lib/auth-config');

    // Test signIn callback for credentials
    const mockAccount = { provider: 'credentials' };
    const mockProfile = {};

    const result = await authConfig.callbacks?.signIn?.({
      account: mockAccount as any,
      profile: mockProfile
    });

    expect(result).toBe(true);
  });

  it('should properly configure credentials provider fields', async () => {
    const { authConfig } = await import('@/lib/auth-config');

    const credentialsProvider = authConfig.providers.find((provider: any) =>
      provider.id === 'credentials'
    ) as any;

    expect(credentialsProvider).toBeDefined();
    expect(credentialsProvider.name).toMatch(/credentials/i);
    expect(typeof credentialsProvider.authorize).toBe('function');
  });

  it('should return null for invalid credentials', async () => {
    const { validatePassword } = await import('@/lib/auth/password');
    const { authenticateUser } = await import('@/lib/auth/users');

    // Mock failed validation
    (validatePassword as any).mockReturnValue({ isValid: false });

    const { authConfig } = await import('@/lib/auth-config');

    const credentialsProvider = authConfig.providers.find((provider: any) =>
      provider.id === 'credentials'
    ) as any;

    const result = await credentialsProvider.authorize({
      email: 'test@example.com',
      password: 'weak',
    });

    expect(result).toBeNull();
    expect(authenticateUser).not.toHaveBeenCalled();
  });

  it('should return null for missing credentials', async () => {
    const { authConfig } = await import('@/lib/auth-config');

    const credentialsProvider = authConfig.providers.find((provider: any) =>
      provider.id === 'credentials'
    ) as any;

    // Test with missing email
    let result = await credentialsProvider.authorize({
      password: 'password123',
    });
    expect(result).toBeNull();

    // Test with missing password
    result = await credentialsProvider.authorize({
      email: 'test@example.com',
    });
    expect(result).toBeNull();

    // Test with both missing
    result = await credentialsProvider.authorize({});
    expect(result).toBeNull();
  });

  it('should handle authentication errors gracefully', async () => {
    const { validatePassword } = await import('@/lib/auth/password');
    const { authenticateUser } = await import('@/lib/auth/users');

    // Mock successful validation but failed authentication
    (validatePassword as any).mockReturnValue({ isValid: true });
    (authenticateUser as any).mockRejectedValue(new Error('Database error'));

    const { authConfig } = await import('@/lib/auth-config');

    const credentialsProvider = authConfig.providers.find((provider: any) =>
      provider.id === 'credentials'
    ) as any;

    const result = await credentialsProvider.authorize({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result).toBeNull();
  });

  it('should have JWT session strategy', async () => {
    const { authConfig } = await import('@/lib/auth-config');

    expect(authConfig.session?.strategy).toBe('jwt');
    expect(authConfig.session?.maxAge).toBe(30 * 24 * 60 * 60); // 30 days
  });

  it('should have proper callback configurations', async () => {
    const { authConfig } = await import('@/lib/auth-config');

    expect(authConfig.callbacks).toBeDefined();
    expect(typeof authConfig.callbacks?.signIn).toBe('function');
    expect(typeof authConfig.callbacks?.session).toBe('function');
    expect(typeof authConfig.callbacks?.jwt).toBe('function');
  });

  it('should not log email auth warnings in test environment', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Import with test environment
    process.env.NODE_ENV = 'test';
    vi.resetModules();
    await import('@/lib/auth-config');

    // Should not warn about email auth in test environment
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Email authentication disabled')
    );

    consoleSpy.mockRestore();
  });
});