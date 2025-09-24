/**
 * Final TDD validation for NextAuth Middleware Compilation
 * This comprehensive test ensures the middleware compilation issue is resolved
 */

import { describe, it, expect } from 'vitest';

describe('Middleware Final Validation', () => {
  it('should successfully import middleware without module resolution errors', async () => {
    // This test validates that the original error "Module not found: Can't resolve 'next-auth/middleware'"
    // is no longer occurring
    let importError: Error | null = null;

    try {
      const middleware = await import('../middleware');
      expect(middleware.middleware).toBeDefined();
      expect(middleware.config).toBeDefined();
    } catch (error) {
      importError = error as Error;
    }

    // Should not have any import errors
    expect(importError).toBeNull();
  });

  it('should use correct NextAuth imports as recommended for Next.js 15', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const middlewarePath = path.resolve(__dirname, '../middleware.ts');
    const content = fs.readFileSync(middlewarePath, 'utf8');

    // Verify we're using the correct import pattern
    expect(content).toContain('import { getToken } from "next-auth/jwt"');

    // Verify we're NOT using the potentially problematic import
    expect(content).not.toContain('from "next-auth/middleware"');
  });

  it('should have NextAuth package properly installed and available', async () => {
    // Verify NextAuth package is installed correctly
    const packageJson = await import('../../package.json');
    expect(packageJson.dependencies['next-auth']).toBeDefined();

    // Verify the JWT functionality is available
    const { getToken } = await import('next-auth/jwt');
    expect(getToken).toBeDefined();
    expect(typeof getToken).toBe('function');
  });

  it('should export middleware function and config correctly', async () => {
    const { middleware, config } = await import('../middleware');

    // Validate middleware function
    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('function');

    // Validate config object
    expect(config).toBeDefined();
    expect(config.matcher).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
  });

  it('should handle Next.js middleware requirements correctly', async () => {
    const { config } = await import('../middleware');

    // Verify proper middleware config structure
    expect(config.matcher).toEqual([
      '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
    ]);
  });
});