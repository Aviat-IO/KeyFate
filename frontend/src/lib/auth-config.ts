import { db } from "@/lib/db/drizzle";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { assertValidOAuthConfig } from "./auth/oauth-config-validator";
import { validatePassword } from "./auth/password";
import { authenticateUser } from "./auth/users";

// Validate OAuth configuration at startup (skip in test environment)
if (process.env.NODE_ENV !== "test") {
  try {
    assertValidOAuthConfig();
  } catch (error) {
    console.error("[Auth Config] OAuth configuration error:", error);
    // In development, provide helpful guidance
    if (process.env.NODE_ENV === "development") {
      console.info(
        "[Auth Config] To fix this, ensure your .env.local file contains:\n" +
          "GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com\n" +
          "GOOGLE_CLIENT_SECRET=your-google-client-secret\n" +
          "NEXTAUTH_SECRET=your-secure-secret-here\n" +
          "NEXTAUTH_URL=http://localhost:3000",
      );
    }
  }
}

// Build providers array conditionally
const providers = [];

// Only add Google provider if credentials are properly configured
if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_ID !==
    "your-google-client-id.apps.googleusercontent.com" &&
  process.env.GOOGLE_CLIENT_SECRET !== "your-google-client-secret" &&
  process.env.GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")
) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  );
} else if (process.env.NODE_ENV === "development") {
  console.warn(
    "[Auth Config] Google OAuth not configured - Google authentication disabled",
  );
  console.info(
    "[Auth Config] To enable Google OAuth, set valid GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local",
  );
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
        return null;
      }

      // Validate password format
      const passwordValidation = validatePassword(credentials.password);
      if (!passwordValidation.isValid) {
        return null;
      }

      try {
        const result = await authenticateUser({
          email: credentials.email,
          password: credentials.password,
        });

        if (result.success && result.user) {
          return {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            image: result.user.image,
          };
        }

        return null;
      } catch (error) {
        console.error("Credentials authentication error:", error);
        return null;
      }
    },
  }),
);

export const authConfig = {
  providers,
  pages: {
    signIn: "/sign-in",
    // Remove error page redirect to prevent NextAuth from redirecting on errors
    // This allows client-side error handling without server-side redirects
    // error: undefined - intentionally omitted to prevent redirects
  },
  callbacks: {
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
    async signIn({ account, profile }) {
      // Check email verification for OAuth providers
      if (account?.provider === "google") {
        // Validate profile structure first
        if (!profile || typeof profile !== "object") {
          console.warn("[Auth] Invalid Google OAuth profile structure");
          return false;
        }

        // Check for email field presence
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const googleProfile = profile as any;
        if (!googleProfile.email) {
          console.warn("[Auth] Google OAuth profile missing email field");
          return false;
        }

        // Google provides email_verified in the profile
        // Handle both boolean and string values that Google might send
        const emailVerified = googleProfile.email_verified;
        let isEmailVerified = false;

        // Convert string values to boolean
        if (typeof emailVerified === "string") {
          isEmailVerified = emailVerified.toLowerCase() === "true";
          console.log(
            "[Auth] Google OAuth email verification status (string):",
            {
              email: googleProfile.email,
              emailVerified: emailVerified,
              converted: isEmailVerified,
            },
          );
        } else if (typeof emailVerified === "boolean") {
          // Handle boolean values
          isEmailVerified = emailVerified;
          console.log(
            "[Auth] Google OAuth email verification status (boolean):",
            {
              email: googleProfile.email,
              emailVerified: emailVerified,
            },
          );
        } else {
          // If email_verified field is missing or not recognized type, treat as unverified
          console.warn(
            "[Auth] Google OAuth email verification field missing or invalid type:",
            {
              email: googleProfile.email,
              emailVerified: emailVerified,
              type: typeof emailVerified,
            },
          );
          return false;
        }

        // Only proceed if email is verified
        if (!isEmailVerified) {
          return false;
        }

        // Create user in database if they don't exist
        try {
          const normalizedEmail = googleProfile.email.toLowerCase().trim();

          // Check if user already exists
          const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

          if (existingUser.length === 0) {
            // Create new user for Google OAuth
            const userData = {
              id: crypto.randomUUID(),
              email: normalizedEmail,
              name: googleProfile.name || null,
              image: googleProfile.picture || null,
              emailVerified: new Date(), // Google email is verified
              password: null, // No password for OAuth users
            };

            await db.insert(users).values(userData);
            console.log("[Auth] Created new user for Google OAuth:", {
              email: normalizedEmail,
              name: userData.name,
            });
          } else {
            console.log("[Auth] Existing user found for Google OAuth:", {
              email: normalizedEmail,
            });
          }

          return true;
        } catch (error) {
          console.error(
            "[Auth] Error creating/checking user for Google OAuth:",
            error,
          );
          return false;
        }
      }

      // Allow credentials provider (we handle authentication in authorize function)
      if (account?.provider === "credentials") {
        return true;
      }

      return false; // Deny access by default
    },
    async session({ session, token }) {
      console.log("[Auth] Session callback triggered:", {
        sessionUser: session?.user?.email,
        tokenId: token?.id,
        tokenSub: token?.sub,
      });

      if (session?.user && (token.id || token.sub)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.id || token.sub;
        console.log(
          "[Auth] Session callback: Set user.id to:",
          token.id || token.sub,
        );
      }
      return session;
    },
    async jwt({ token, user, account, profile }) {
      console.log("[Auth] JWT callback triggered:", {
        hasToken: !!token,
        hasUser: !!user,
        hasAccount: !!account,
        hasProfile: !!profile,
        accountProvider: account?.provider,
        tokenId: token?.id,
        userEmail: (profile as any)?.email || user?.email,
      });

      // For Google OAuth, always look up the user in the database by email
      if (account?.provider === "google" && profile) {
        console.log("[Auth] Processing Google OAuth in JWT callback");
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const googleProfile = profile as any;
          const normalizedEmail = googleProfile.email?.toLowerCase().trim();
          console.log("[Auth] Normalized email:", normalizedEmail);

          if (normalizedEmail) {
            console.log("[Auth] Looking up user in database...");
            const dbUser = await db
              .select()
              .from(users)
              .where(eq(users.email, normalizedEmail))
              .limit(1);

            console.log(
              "[Auth] Database lookup result:",
              dbUser.length > 0 ? "FOUND" : "NOT_FOUND",
            );

            if (dbUser.length > 0) {
              token.id = dbUser[0].id;
              console.log(
                "[Auth] JWT callback: Set token.id to database user ID:",
                dbUser[0].id,
              );
            } else {
              console.error(
                "[Auth] JWT callback: User not found in database for email:",
                normalizedEmail,
              );
            }
          }
        } catch (error) {
          console.error("[Auth] Error looking up user in JWT callback:", error);
        }
      } else if (user) {
        // For credentials provider, use the user ID directly
        console.log("[Auth] Processing credentials provider in JWT callback");
        token.id = user.id;
      }

      if (account) {
        token.accessToken = account.access_token;
      }

      console.log("[Auth] JWT callback final token.id:", token.id);
      return token;
    },
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
