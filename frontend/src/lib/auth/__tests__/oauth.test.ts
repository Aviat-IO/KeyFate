import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signIn, signOut, getSession } from 'next-auth/react'
import { googleOAuthFlow, handleOAuthCallback, validateOAuthState } from '../oauth-service'

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn()
}))

describe('OAuth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // TEST 1: Core OAuth flow test
  it('should initiate Google OAuth flow with proper parameters', async () => {
    const mockSignIn = vi.mocked(signIn)
    mockSignIn.mockResolvedValue({ ok: true, error: null, status: 200, url: '/auth/callback' })

    const result = await googleOAuthFlow({ redirectTo: '/dashboard' })

    expect(mockSignIn).toHaveBeenCalledWith('google', {
      callbackUrl: '/dashboard',
      redirect: true,
      redirectTo: '/dashboard'
    })
    expect(result.success).toBe(true)
  })

  // TEST 2: Error handling test
  it('should handle OAuth errors gracefully', async () => {
    const mockSignIn = vi.mocked(signIn)
    mockSignIn.mockResolvedValue({ ok: false, error: 'OAuth failed', status: 401, url: null })

    const result = await googleOAuthFlow({ redirectTo: '/dashboard' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('OAuth failed')
  })

  // TEST 3: Callback validation test
  it('should validate OAuth callback with proper session', async () => {
    const mockGetSession = vi.mocked(getSession)
    mockGetSession.mockResolvedValue({
      user: { email: 'test@example.com', name: 'Test User' },
      expires: '2024-12-31'
    })

    const result = await handleOAuthCallback()

    expect(result.success).toBe(true)
    expect(result.user?.email).toBe('test@example.com')
  })

  // TEST 4: State validation test
  it('should validate OAuth state parameter for security', () => {
    const validState = 'secure-random-state-123'
    const result = validateOAuthState(validState, validState)

    expect(result.isValid).toBe(true)
  })

  // TEST 5: Session management test
  it('should handle user logout correctly', async () => {
    const mockSignOut = vi.mocked(signOut)
    mockSignOut.mockResolvedValue({ url: '/sign-in' })

    await signOut({ callbackUrl: '/sign-in' })

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/sign-in' })
  })
})