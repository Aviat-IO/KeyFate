/**
 * Integration test to verify NextAuth migration is complete
 * This test verifies that the routes no longer have Supabase dependencies
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('NextAuth Migration Integration', () => {
  it('should not import Supabase in verification-status route', () => {
    const filePath = join(process.cwd(), 'src/app/api/auth/verification-status/route.ts');
    const fileContent = readFileSync(filePath, 'utf-8');

    expect(fileContent).not.toContain('@/utils/supabase');
    expect(fileContent).not.toContain('createClient');
    expect(fileContent).toContain('getServerSession');
    expect(fileContent).toContain('next-auth');
    expect(fileContent).toContain('@/lib/db/drizzle');
  });

  it('should not import Supabase in verify-email route', () => {
    const filePath = join(process.cwd(), 'src/app/api/auth/verify-email/route.ts');
    const fileContent = readFileSync(filePath, 'utf-8');

    expect(fileContent).not.toContain('@/utils/supabase');
    expect(fileContent).not.toContain('createClient');
    expect(fileContent).not.toContain('supabase.auth.verifyOtp');
    expect(fileContent).toContain('@/lib/db/drizzle');
    expect(fileContent).toContain('verificationTokens');
  });

  it('should maintain Drizzle usage in resend-verification route', () => {
    const filePath = join(process.cwd(), 'src/app/api/auth/resend-verification/route.ts');
    const fileContent = readFileSync(filePath, 'utf-8');

    // This route was already using the email-verification service which uses Drizzle
    expect(fileContent).not.toContain('@/utils/supabase');
    expect(fileContent).toContain('resendVerificationEmail');
  });

  it('should use proper NextAuth types and imports', () => {
    const verificationStatusPath = join(process.cwd(), 'src/app/api/auth/verification-status/route.ts');
    const verificationStatusContent = readFileSync(verificationStatusPath, 'utf-8');

    expect(verificationStatusContent).toContain('import { getServerSession } from \'next-auth\'');
    expect(verificationStatusContent).toContain('import { authOptions } from \'@/lib/auth/config\'');
    expect(verificationStatusContent).toContain('session?.user?.id');
  });

  it('should use proper database operations', () => {
    const verifyEmailPath = join(process.cwd(), 'src/app/api/auth/verify-email/route.ts');
    const verifyEmailContent = readFileSync(verifyEmailPath, 'utf-8');

    expect(verifyEmailContent).toContain('.select()');
    expect(verifyEmailContent).toContain('.update(');
    expect(verifyEmailContent).toContain('.delete(');
    expect(verifyEmailContent).toContain('eq(users.email');
    expect(verifyEmailContent).toContain('emailVerified: new Date()');
  });
});