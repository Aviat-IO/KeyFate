/**
 * OAuth Configuration Validator
 * Validates Google OAuth and Auth.js environment setup
 *
 * SvelteKit uses PUBLIC_SITE_URL (via SITE_URL from $lib/env) instead of NEXTAUTH_URL,
 * and AUTH_SECRET instead of NEXTAUTH_SECRET.
 */

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface OAuthConfig {
  googleClientId?: string
  googleClientSecret?: string
  authSecret?: string
  siteUrl?: string
  /** @deprecated Use authSecret */
  nextAuthSecret?: string
  /** @deprecated Use siteUrl */
  nextAuthUrl?: string
}

/**
 * Validates Google OAuth configuration
 */
export function validateOAuthConfig(config?: OAuthConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Use provided config or environment variables
  const googleClientId = config
    ? config.googleClientId
    : process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = config
    ? config.googleClientSecret
    : process.env.GOOGLE_CLIENT_SECRET
  const authSecret = config
    ? (config.authSecret || config.nextAuthSecret)
    : (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
  const siteUrl = config
    ? (config.siteUrl || config.nextAuthUrl)
    : (process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL)

  // Required environment variables
  if (!googleClientId) {
    errors.push("GOOGLE_CLIENT_ID is required for Google OAuth")
  } else if (!googleClientId.endsWith(".apps.googleusercontent.com")) {
    errors.push(
      "GOOGLE_CLIENT_ID must be a valid Google OAuth client ID ending with .apps.googleusercontent.com",
    )
  }

  if (!googleClientSecret) {
    errors.push("GOOGLE_CLIENT_SECRET is required for Google OAuth")
  } else if (googleClientSecret.length < 24) {
    warnings.push("GOOGLE_CLIENT_SECRET seems too short, verify it is correct")
  }

  if (!authSecret) {
    errors.push("AUTH_SECRET is required for Auth.js")
  } else if (authSecret === "your-nextauth-secret-here") {
    warnings.push("AUTH_SECRET should be changed from the default value")
  } else if (authSecret.length < 32) {
    warnings.push(
      "AUTH_SECRET should be at least 32 characters long for security",
    )
  }

  if (!siteUrl) {
    errors.push("PUBLIC_SITE_URL is required for Auth.js")
  } else if (!siteUrl.match(/^https?:\/\//)) {
    errors.push(
      "PUBLIC_SITE_URL must be a valid URL starting with http:// or https://",
    )
  }

  // Development environment warnings
  if (process.env.NODE_ENV === "development") {
    if (siteUrl?.startsWith("http://")) {
      warnings.push(
        "Using HTTP in development is acceptable, but ensure HTTPS is used in production",
      )
    }
  }

  // Production environment checks
  // During build time, we don't validate HTTPS requirement as the actual runtime URL
  // will be provided by the production environment variables at runtime
  // We detect build time by checking if PUBLIC_SITE_URL is localhost (build environment)
  // while NODE_ENV is production (production build)
  const isBuildTime =
    process.env.NODE_ENV === "production" && siteUrl?.includes("localhost")

  if (process.env.NODE_ENV === "production" && !isBuildTime) {
    // Only enforce HTTPS for actual production runtime, not build time
    if (
      siteUrl?.startsWith("http://") &&
      !siteUrl.includes("localhost")
    ) {
      errors.push("PUBLIC_SITE_URL must use HTTPS in production")
    }

    if (authSecret === "your-nextauth-secret-here") {
      errors.push(
        "AUTH_SECRET must be changed from default value in production",
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validates OAuth configuration and throws if invalid
 */
export function assertValidOAuthConfig(config?: OAuthConfig): void {
  const result = validateOAuthConfig(config)

  if (!result.isValid) {
    throw new Error(`OAuth configuration invalid:\n${result.errors.join("\n")}`)
  }

  // Removed verbose development logging
}

/**
 * Gets current OAuth configuration from environment
 */
export function getCurrentOAuthConfig(): OAuthConfig {
  return {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authSecret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    siteUrl: process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL,
  }
}

/**
 * Checks if OAuth is properly configured
 */
export function isOAuthConfigured(): boolean {
  const result = validateOAuthConfig()
  return result.isValid
}
