import { getDatabase } from "@/lib/db/drizzle"
import { users } from "@/lib/db/schema"
import { logLogin } from "@/lib/services/audit-logger"
import { eq } from "drizzle-orm"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { getBaseUrl, withProductionConfig } from "./auth-config-production"
import { assertValidOAuthConfig } from "./auth/oauth-config-validator"
import { validatePassword } from "./auth/password"
import { authenticateUser } from "./auth/users"
import { validateAuthEnvironment } from "./auth/validate-env"

// Validate auth environment and OAuth configuration at startup (skip in test environment)
if (process.env.NODE_ENV !== "test") {
  // First validate environment variables
  const envValidation = validateAuthEnvironment()
  if (!envValidation.isValid) {
    console.error(
      "[Auth Config] Missing environment variables:",
      envValidation.missing,
    )
  }

  // Then validate OAuth configuration
  try {
    assertValidOAuthConfig()
  } catch (error) {
    console.error("[Auth Config] OAuth configuration error:", error)
    // In development, provide helpful guidance
    if (process.env.NODE_ENV === "development") {
      console.info(
        "[Auth Config] To fix this, ensure your .env.local file contains:\n" +
          "GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com\n" +
          "GOOGLE_CLIENT_SECRET=your-google-client-secret\n" +
          "NEXTAUTH_SECRET=your-secure-secret-here\n" +
          "NEXTAUTH_URL=http://localhost:3000",
      )
    }
  }
}

// Build providers array conditionally
const providers = []

// Only add Google provider if credentials are properly configured
if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_ID !==
    "your-google-client-id.apps.googleusercontent.com" &&
  process.env.GOOGLE_CLIENT_SECRET !== "your-google-client-secret" &&
  process.env.GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")
) {
  // Get the correct base URL for OAuth redirects
  const baseUrl = getBaseUrl()

  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          redirect_uri: `${baseUrl}/api/auth/callback/google`,
        },
      },
    }),
  )
} else if (process.env.NODE_ENV === "development") {
  console.warn(
    "[Auth Config] Google OAuth not configured - Google authentication disabled",
  )
  console.info(
    "[Auth Config] To enable Google OAuth, set valid GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local",
  )
}

// Email provider removed - using only Google OAuth and credentials authentication

// Add Credentials provider for email+password authentication (always available)
providers.push(
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: {
        label: "Email",
        type: "email",
        placeholder: "your@email.com",
      },
      password: {
        label: "Password",
        type: "password",
      },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      // Validate password format
      const passwordValidation = validatePassword(credentials.password)
      if (!passwordValidation.isValid) {
        return null
      }

      try {
        const result = await authenticateUser({
          email: credentials.email,
          password: credentials.password,
        })

        if (result.success && result.user) {
          return {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            image: result.user.image,
          }
        }

        return null
      } catch (error) {
        console.error("Credentials authentication error:", error)
        return null
      }
    },
  }),
)

const baseAuthConfig = {
  providers,
  pages: {
    signIn: "/sign-in",
    error: "/auth/error",
  },
  callbacks: {
    /**
     * Ensure OAuth redirects use the correct base URL
     */
    async redirect({ url, baseUrl }) {
      const correctBaseUrl = getBaseUrl()

      if (url.startsWith("/")) return `${correctBaseUrl}${url}`
      if (url.includes("0.0.0.0")) {
        return url.replace(/https?:\/\/0\.0\.0\.0(:\d+)?/, correctBaseUrl)
      }
      if (url.startsWith(correctBaseUrl)) return url

      return correctBaseUrl
    },
    /**
     * TASK 1.2: Google OAuth Email Verification Enforcement
     *
     * This callback enforces email verification for Google OAuth users.
     * Only users with verified Google email addresses are allowed to sign in.
     *
     * Features:
     * - Validates Google profile structure and email field presence
     * - Enforces email_verified = true for Google OAuth
     * - Handles both boolean and string email_verified values
     * - Rejects malformed or incomplete profiles
     * - Maintains backward compatibility with credentials auth
     *
     * Security: Prevents unverified Google accounts from accessing the system
     */
    async signIn({ user, account, profile }) {
      // Check email verification for OAuth providers
      if (account?.provider === "google") {
        // Validate profile structure first
        if (!profile || typeof profile !== "object") {
          console.warn("[Auth] Invalid Google OAuth profile structure")
          return false
        }

        // Check for email field presence
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const googleProfile = profile as any
        if (!googleProfile.email) {
          console.warn("[Auth] Google OAuth profile missing email field")
          return false
        }

        // Google provides email_verified in the profile
        // Handle both boolean and string values that Google might send
        const emailVerified = googleProfile.email_verified
        let isEmailVerified = false

        // Convert string values to boolean
        if (typeof emailVerified === "string") {
          isEmailVerified = emailVerified.toLowerCase() === "true"
        } else if (typeof emailVerified === "boolean") {
          // Handle boolean values
          isEmailVerified = emailVerified
        } else {
          // If email_verified field is missing or not recognized type, treat as unverified
          console.warn(
            "[Auth] Google OAuth email verification field missing or invalid type:",
            {
              email: googleProfile.email,
              emailVerified: emailVerified,
              type: typeof emailVerified,
            },
          )
          return false
        }

        // Only proceed if email is verified
        if (!isEmailVerified) {
          return false
        }

        // Create user in database if they don't exist
        try {
          const normalizedEmail = googleProfile.email.toLowerCase().trim()

          // Get database connection
          const db = await getDatabase()

          // Check if user already exists
          const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1)

          if (existingUser.length === 0) {
            // Create new user for Google OAuth
            const userData = {
              id: crypto.randomUUID(),
              email: normalizedEmail,
              name: googleProfile.name || null,
              image: googleProfile.picture || null,
              emailVerified: new Date(), // Google email is verified
              password: null, // No password for OAuth users
            }

            await db.insert(users).values(userData)

            await logLogin(userData.id, {
              provider: "google",
              email: normalizedEmail,
              newUser: true,
            })
          } else {
            await logLogin(existingUser[0].id, {
              provider: "google",
              email: normalizedEmail,
              newUser: false,
            })
          }

          return true
        } catch (error) {
          console.error(
            "[Auth] Error creating/checking user for Google OAuth:",
            error,
          )
          return false
        }
      }

      // Allow credentials provider (we handle authentication in authorize function)
      if (account?.provider === "credentials" && user?.id) {
        await logLogin(user.id, {
          provider: "credentials",
          email: user.email || undefined,
        })
        return true
      }

      return false // Deny access by default
    },
    async session({ session, token }) {
      if (session?.user) {
        // Always set the user ID from the token
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).id = token.id || token.sub
        // Also ensure email is set
        if (!session.user.email && token.email) {
          session.user.email = token.email as string
        }
        // Add email verification status to session
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).emailVerified = token.emailVerified || null
      }
      return session
    },
    async jwt({ token, user, account, profile }) {
      // For Google OAuth, always look up the user in the database by email
      if (account?.provider === "google" && profile) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const googleProfile = profile as any
          const normalizedEmail = googleProfile.email?.toLowerCase().trim()

          if (normalizedEmail) {
            const db = await getDatabase()
            const dbUser = await db
              .select()
              .from(users)
              .where(eq(users.email, normalizedEmail))
              .limit(1)

            if (dbUser.length > 0) {
              token.id = dbUser[0].id
              token.emailVerified = dbUser[0].emailVerified
            } else {
              console.error(
                "[Auth] JWT callback: User not found in database for email:",
                normalizedEmail,
              )
            }
          }
        } catch (error) {
          console.error("[Auth] Error looking up user in JWT callback:", error)
        }
      } else if (user) {
        // For credentials provider, use the user ID directly
        token.id = user.id
        // Fetch email verification status from database
        try {
          const db = await getDatabase()
          const dbUser = await db
            .select()
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1)

          if (dbUser.length > 0) {
            token.emailVerified = dbUser[0].emailVerified
          }
        } catch (error) {
          console.error(
            "[Auth] Error fetching email verification status:",
            error,
          )
        }
      }

      if (account) {
        token.accessToken = account.access_token
      }

      return token
    },
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// Export the config with production-specific settings applied
export const authConfig = withProductionConfig(baseAuthConfig)
