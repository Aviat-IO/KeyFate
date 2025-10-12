// import { createClient } from '@/utils/supabase/client'
// import type { User } from '@supabase/supabase-js'

// TODO: Replace with NextAuth types
interface NextAuthUser {
  id: string
  email?: string
  name?: string
  image?: string
  email_verified?: boolean
}

export interface EmailVerificationResult {
  success: boolean
  user?: NextAuthUser
  error?: string
  alreadyVerified?: boolean
  requiresVerification?: boolean
}

export interface EmailVerificationStatus {
  isVerified: boolean
  user?: NextAuthUser | null
  error?: string | null
}

/**
 * Verify email address using OTP code
 * TODO: Implement with NextAuth email verification
 */
export async function verifyEmailWithOTP(
  email: string,
  otp: string,
): Promise<EmailVerificationResult> {
  try {
    // TODO: Replace with NextAuth email verification
    console.warn(
      "[Email Verification] verifyEmailWithOTP is deprecated - use NextAuth instead",
    )

    return {
      success: false,
      error: "Function deprecated - use NextAuth email verification",
    }
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred during verification",
    }
  }
}

/**
 * Send OTP verification code to email
 * TODO: Implement with NextAuth email verification
 */
export async function sendVerificationOTP(
  email: string,
): Promise<EmailVerificationResult> {
  try {
    // TODO: Replace with NextAuth email provider
    console.warn(
      "[Email Verification] sendVerificationOTP is deprecated - use NextAuth instead",
    )

    return {
      success: false,
      error: "Function deprecated - use NextAuth email verification",
    }
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred during verification",
    }
  }
}

/**
 * Get current email verification status
 * TODO: Implement with NextAuth session
 */
export async function getEmailVerificationStatus(
  email?: string,
): Promise<EmailVerificationStatus> {
  // Delegate to the shim that tests mock
  return checkEmailVerificationStatus(email)
}

/**
 * Compatibility shim used by tests to query current verification status.
 * Real implementation lives in NextAuth flow; tests mock this function.
 */
export async function checkEmailVerificationStatus(
  email?: string,
): Promise<EmailVerificationStatus> {
  return {
    isVerified: false,
    user: email ? ({ id: "", email } as NextAuthUser) : null,
    error: null,
  }
}

/**
 * Check if user needs email verification
 * TODO: Implement with NextAuth session
 */
export async function checkEmailVerificationRequired(
  user?: NextAuthUser,
): Promise<boolean> {
  // TODO: Replace with NextAuth logic
  console.warn(
    "[Email Verification] checkEmailVerificationRequired is deprecated - use NextAuth instead",
  )
  return false
}

/**
 * Mark email as verified in database
 * TODO: Implement with NextAuth callbacks
 */
export async function markEmailVerified(userId: string): Promise<boolean> {
  try {
    // TODO: Replace with NextAuth database update
    console.warn(
      "[Email Verification] markEmailVerified is deprecated - use NextAuth callbacks",
    )
    return false
  } catch {
    return false
  }
}

/**
 * Resend verification email
 * TODO: Implement with NextAuth email provider
 */
export async function resendVerificationEmail(
  email: string,
): Promise<EmailVerificationResult> {
  try {
    // TODO: Replace with NextAuth email resend
    console.warn(
      "[Email Verification] resendVerificationEmail is deprecated - use NextAuth instead",
    )

    return {
      success: false,
      error: "Function deprecated - use NextAuth email verification",
    }
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred during resend",
    }
  }
}
