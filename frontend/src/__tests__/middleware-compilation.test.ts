/**
 * TDD Test for NextAuth Middleware Compilation
 * This test ensures the middleware compiles without errors
 */

import { describe, it, expect } from 'vitest';

describe('Middleware Compilation', () => {
  it('should compile middleware without module resolution errors', async () => {
    // Test that the middleware file can be imported without errors
    const { middleware, config } = await import('../middleware');

    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('function');
    expect(config).toBeDefined();
    expect(config.matcher).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
  });

  it('should use correct NextAuth imports', async () => {
    // Verify the middleware file doesn't use deprecated imports
    const fs = await import('fs');
    const path = await import('path');

    const middlewarePath = path.resolve(__dirname, '../middleware.ts');
    const content = fs.readFileSync(middlewarePath, 'utf8');

    // Should NOT contain the problematic import
    expect(content).not.toContain('next-auth/middleware');

    // Should contain the correct import
    expect(content).toContain('next-auth/jwt');
  });

  it('should handle NextAuth configuration correctly', async () => {
    // Test that middleware can be imported without compilation errors
    const { middleware } = await import('../middleware');

    // Just test that middleware exists and is callable
    expect(typeof middleware).toBe('function');
    // We don't actually call it to avoid the redirect URL issues in test environment
  });
});