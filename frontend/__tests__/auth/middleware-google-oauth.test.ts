/**
 * Test: Google OAuth Edge Runtime Fix
 *
 * This test verifies that the middleware can handle Google OAuth users
 * without throwing Edge Runtime errors related to 'perf_hooks' module.
 *
 * The fix involves:
 * 1. Setting middleware runtime to 'nodejs' instead of Edge Runtime
 * 2. Creating OAuth users in database during signIn callback
 * 3. Properly handling user lookup in middleware
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../src/middleware';
import { getToken } from 'next-auth/jwt';
import { getUserById } from '../../src/lib/auth/users';

// Mock dependencies
vi.mock('next-auth/jwt');
vi.mock('../../src/lib/auth/users');

const mockGetToken = getToken as Mock;
const mockGetUserById = getUserById as Mock;

describe('Middleware Google OAuth Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should handle Google OAuth users without Edge Runtime errors', async () => {
    // Mock a Google OAuth JWT token
    const mockToken = {
      sub: 'google-user-123',
      id: 'google-user-123', // This would be set by our JWT callback
      email: 'user@example.com',
      provider: 'google'
    };

    // Mock a user from database (created during OAuth sign-in)
    const mockUser = {
      id: 'google-user-123',
      email: 'user@example.com',
      name: 'Test User',
      emailVerified: new Date(),
      image: 'https://example.com/avatar.jpg',
      password: null, // OAuth users don't have passwords
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockGetToken.mockResolvedValue(mockToken);
    mockGetUserById.mockResolvedValue(mockUser);

    // Create a request to the dashboard (protected route)
    const url = new URL('http://localhost:3000/dashboard');
    const request = new NextRequest(url);

    // Execute middleware
    const response = await middleware(request);

    // Should allow access to dashboard since user is authenticated and email verified
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');

    // Verify getUserById was called with correct user ID
    expect(mockGetUserById).toHaveBeenCalledWith('google-user-123');

    // Should not have any errors logged
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should handle case where OAuth user is not found in database', async () => {
    // Mock a Google OAuth JWT token
    const mockToken = {
      sub: 'google-user-missing',
      id: 'google-user-missing',
      email: 'missing@example.com',
      provider: 'google'
    };

    mockGetToken.mockResolvedValue(mockToken);
    mockGetUserById.mockResolvedValue(null); // User not found in database

    const url = new URL('http://localhost:3000/dashboard');
    const request = new NextRequest(url);

    const response = await middleware(request);

    // Should redirect to login when user not found
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/sign-in');
    expect(response.headers.get('location')).toContain('error=User+account+not+found');
  });

  it('should handle database errors gracefully', async () => {
    const mockToken = {
      sub: 'google-user-123',
      id: 'google-user-123',
      email: 'user@example.com'
    };

    mockGetToken.mockResolvedValue(mockToken);

    // Simulate database error (this was the original Edge Runtime issue)
    const dbError = new Error("The edge runtime does not support Node.js 'perf_hooks' module");
    mockGetUserById.mockRejectedValue(dbError);

    const url = new URL('http://localhost:3000/dashboard');
    const request = new NextRequest(url);

    const response = await middleware(request);

    // Should handle error gracefully and redirect to login
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/sign-in');
    expect(response.headers.get('location')).toContain('error=Authentication+error+occurred');

    // Should log the database error
    expect(console.error).toHaveBeenCalledWith(
      '[Middleware] Database error during user lookup:',
      dbError
    );
  });

  it('should handle token with missing user ID', async () => {
    // Mock a malformed token without user ID
    const mockToken = {
      email: 'user@example.com',
      // Missing sub and id properties
    };

    mockGetToken.mockResolvedValue(mockToken);

    const url = new URL('http://localhost:3000/dashboard');
    const request = new NextRequest(url);

    const response = await middleware(request);

    // Should redirect to login when no user ID found
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/sign-in');
    expect(response.headers.get('location')).toContain('error=Invalid+session+token');

    // getUserById should not be called
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it('should allow access to public routes without database queries', async () => {
    // Don't mock token - simulating unauthenticated user
    mockGetToken.mockResolvedValue(null);

    const url = new URL('http://localhost:3000/');
    const request = new NextRequest(url);

    const response = await middleware(request);

    // Should allow access to public route
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');

    // Should not call database functions for public routes
    expect(mockGetUserById).not.toHaveBeenCalled();
  });
});