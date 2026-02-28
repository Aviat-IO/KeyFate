import { SvelteKitAuth } from "@auth/sveltekit"
import Google from "@auth/sveltekit/providers/google"
import Credentials from "@auth/sveltekit/providers/credentials"
import { getDatabase } from "$lib/db/drizzle"
import { users, type UserInsert } from "$lib/db/schema"
import { eq } from "drizzle-orm"
import { validatePassword } from "$lib/auth/password"
import { authenticateUser } from "$lib/auth/users"
import { validateOTPToken } from "$lib/auth/otp"
import { recordPrivacyPolicyAcceptance } from "$lib/auth/privacy-policy"
import { logLogin } from "$lib/services/audit-logger"

// Auth.js automatically reads AUTH_SECRET from env.
// Google provider auto-reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.
// We use trustHost: true for proxy environments (Cloud Run, etc.).

export const { handle, signIn, signOut } = SvelteKitAuth({
  trustHost: true,
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otpCode: { label: "OTP Code", type: "text" },
        action: { label: "Action", type: "text" },
        verificationToken: { label: "Verification Token", type: "text" },
        userId: { label: "User ID", type: "text" },
      },
      async authorize(credentials) {
        // Verification token flow (post-email-verification auto-login)
        if (credentials?.verificationToken && credentials?.userId) {
          try {
            const db = await getDatabase()
            const userResult = await db
              .select()
              .from(users)
              .where(eq(users.id, credentials.userId as string))
              .limit(1)

            const user = userResult[0]
            if (user && user.emailVerified) {
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
              }
            }
          } catch (error) {
            console.error("Verification token authentication error:", error)
            return null
          }
        }

        if (!credentials?.email) {
          return null
        }

        const email = credentials.email as string
        const action = (credentials.action as string) || "otp"

        // OTP authentication flow
        if (action === "otp" && credentials.otpCode) {
          try {
            const validationResult = await validateOTPToken(
              email,
              credentials.otpCode as string,
            )

            if (!validationResult.success || !validationResult.valid) {
              return null
            }

            const db = await getDatabase()
            let userResult = await db
              .select()
              .from(users)
              .where(eq(users.email, email.toLowerCase().trim()))
              .limit(1)

            let user
            if (userResult.length === 0) {
              const userId = crypto.randomUUID()
              const newUsers = await db
                .insert(users)
                .values({
                  id: userId,
                  email: email.toLowerCase().trim(),
                  emailVerified: new Date(),
                  password: null,
                  name: null,
                  image: null,
                } as UserInsert)
                .returning()
              user = newUsers[0]

              await recordPrivacyPolicyAcceptance(userId)
            } else {
              user = userResult[0]
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
            }
          } catch (error) {
            console.error("OTP authentication error:", error)
            return null
          }
        }

        // Password authentication flow
        if (action === "password" && credentials.password) {
          const passwordValidation = validatePassword(
            credentials.password as string,
          )
          if (!passwordValidation.isValid) {
            return null
          }

          try {
            const result = await authenticateUser({
              email,
              password: credentials.password as string,
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
            console.error("Password authentication error:", error)
            return null
          }
        }

        return null
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Refresh every hour
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Google OAuth: enforce email verification, create/link user in DB
      if (account?.provider === "google") {
        if (!profile || typeof profile !== "object") {
          console.warn("[Auth] Invalid Google OAuth profile structure")
          return false
        }

        const googleProfile = profile as {
          email?: string
          email_verified?: boolean | string
          name?: string
          picture?: string
        }

        if (!googleProfile.email) {
          console.warn("[Auth] Google OAuth profile missing email field")
          return false
        }

        // Validate email_verified
        const emailVerified = googleProfile.email_verified
        let isEmailVerified = false

        if (typeof emailVerified === "string") {
          isEmailVerified = emailVerified.toLowerCase() === "true"
        } else if (typeof emailVerified === "boolean") {
          isEmailVerified = emailVerified
        } else {
          console.warn(
            "[Auth] Google OAuth email verification field missing or invalid type:",
            {
              email: googleProfile.email,
              emailVerified,
              type: typeof emailVerified,
            },
          )
          return false
        }

        if (!isEmailVerified) {
          return false
        }

        // Create or find user in database
        try {
          const normalizedEmail = googleProfile.email.toLowerCase().trim()
          const db = await getDatabase()

          const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1)

          if (existingUser.length === 0) {
            const userId = crypto.randomUUID()
            await db.insert(users).values({
              id: userId,
              email: normalizedEmail,
              name: googleProfile.name || null,
              image: googleProfile.picture || null,
              emailVerified: new Date(),
              password: null,
            } as UserInsert)

            await recordPrivacyPolicyAcceptance(userId)

            await logLogin(userId, {
              provider: "google",
              email: normalizedEmail,
              newUser: true,
              resourceType: "auth_method",
              resourceId: `google:${normalizedEmail}`,
            })
          } else {
            await logLogin(existingUser[0].id, {
              provider: "google",
              email: normalizedEmail,
              newUser: false,
              resourceType: "auth_method",
              resourceId: `google:${normalizedEmail}`,
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

      // Credentials: audit log
      if (account?.provider === "credentials" && user?.id) {
        await logLogin(user.id, {
          provider: "credentials",
          email: user.email || undefined,
          resourceType: "auth_method",
          resourceId: user.email ? `otp:${user.email}` : "otp:unknown",
        })
        return true
      }

      return false
    },

    async jwt({ token, user, account, profile }) {
      // Google OAuth: look up user in DB by email to get our internal user ID
      if (account?.provider === "google" && profile) {
        try {
          const googleProfile = profile as {
            email?: string
            name?: string
            picture?: string
          }
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
        // Credentials login: set user ID and fetch emailVerified from DB
        token.id = user.id
        try {
          const db = await getDatabase()
          const dbUser = await db
            .select()
            .from(users)
            .where(eq(users.id, user.id!))
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

    async session({ session, token }) {
      if (session?.user) {
        session.user.id = (token.id as string) || (token.sub as string)
        if (!session.user.email && token.email) {
          session.user.email = token.email
        }
        // Expose emailVerified on session user
        ;(session.user as any).emailVerified =
          (token.emailVerified as Date | null) || null
      }
      return session
    },
  },
})
