/**
 * Environment Variable Validation
 *
 * Validates required environment variables at application startup
 * to prevent runtime errors from missing configuration.
 */

import { z } from "zod"

/**
 * Environment variable schema
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  DIRECT_URL: z.string().url("DIRECT_URL must be a valid URL").optional(),

  // NextAuth
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters"),

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Email Service
  SENDGRID_API_KEY: z.string().min(10, "SENDGRID_API_KEY is required"),
  SENDGRID_ADMIN_EMAIL: z.string().email("SENDGRID_ADMIN_EMAIL must be valid"),
  SENDGRID_SENDER_NAME: z.string().optional(),

  // Encryption
  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[A-Za-z0-9+/=]{44}$/,
      "ENCRYPTION_KEY must be valid base64 (32 bytes)",
    ),

  // Stripe (optional for development)
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),

  // BTCPay (optional)
  BTCPAY_SERVER_URL: z.string().url().optional(),
  BTCPAY_API_KEY: z.string().optional(),
  BTCPAY_STORE_ID: z.string().optional(),
  BTCPAY_WEBHOOK_SECRET: z.string().optional(),

  // Cron Security
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters"),

  // Admin (optional)
  ADMIN_TOKEN: z.string().min(32).optional(),
  ADMIN_IP_WHITELIST: z.string().optional(),

  // Node Environment
  NODE_ENV: z.enum(["development", "production", "test"]),

  // Public URLs
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_COMPANY: z.string().optional(),
  NEXT_PUBLIC_PARENT_COMPANY: z.string().optional(),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
})

/**
 * Validation result
 */
export interface EnvValidationResult {
  success: boolean
  errors?: string[]
  warnings?: string[]
}

/**
 * Validate environment variables
 *
 * @param throwOnError - Whether to throw an error if validation fails
 * @returns Validation result
 */
export function validateEnv(throwOnError = true): EnvValidationResult {
  const result = envSchema.safeParse(process.env)

  if (result.success) {
    return {
      success: true,
      warnings: generateWarnings(),
    }
  }

  const errors = result.error.errors.map((err) => {
    return `${err.path.join(".")}: ${err.message}`
  })

  if (throwOnError) {
    console.error("❌ Environment validation failed:")
    errors.forEach((err) => console.error(`  - ${err}`))
    throw new Error(
      `Environment validation failed. Missing or invalid configuration:\n${errors.join("\n")}`,
    )
  }

  return {
    success: false,
    errors,
  }
}

/**
 * Generate warnings for optional but recommended env vars
 */
function generateWarnings(): string[] {
  const warnings: string[] = []

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    warnings.push("Google OAuth not configured - OAuth login unavailable")
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    warnings.push("Stripe not configured - Payment processing unavailable")
  }

  if (!process.env.BTCPAY_SERVER_URL) {
    warnings.push("BTCPay not configured - Crypto payments unavailable")
  }

  if (!process.env.ADMIN_TOKEN) {
    warnings.push("Admin token not configured - Admin endpoints unavailable")
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.SENTRY_DSN) {
      warnings.push("Sentry not configured - Error tracking unavailable")
    }

    if (process.env.ENCRYPTION_KEY === "test-key-do-not-use-in-production") {
      warnings.push("⚠️ WARNING: Using default encryption key in production!")
    }
  }

  return warnings
}

/**
 * Log validation results
 */
export function logEnvValidation(result: EnvValidationResult): void {
  if (result.success) {
    console.log("✅ Environment validation passed")

    if (result.warnings && result.warnings.length > 0) {
      console.log("\n⚠️  Warnings:")
      result.warnings.forEach((warning) => console.log(`  - ${warning}`))
    }
  } else {
    console.error("❌ Environment validation failed:")
    result.errors?.forEach((error) => console.error(`  - ${error}`))
  }
}

/**
 * Check if environment is production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}

/**
 * Check if environment is development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development"
}

/**
 * Check if environment is test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === "test"
}

/**
 * Get required environment variable
 *
 * Throws if not found, useful for critical config
 */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`)
  }
  return value
}

/**
 * Get optional environment variable with default
 */
export function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

// Validate on module load in production
if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
  const result = validateEnv(false)
  logEnvValidation(result)

  if (!result.success) {
    // Log but don't crash - allow graceful degradation
    console.error("⚠️  Application starting with invalid configuration")
  }
}
