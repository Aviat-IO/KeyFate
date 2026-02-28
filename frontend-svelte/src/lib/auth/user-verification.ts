/**
 * User Verification Service
 *
 * Handles user existence verification and creation for authenticated sessions.
 * Ensures that users from NextAuth sessions have corresponding database records
 * before performing operations that require foreign key constraints.
 */

import { getDatabase } from "$lib/db/drizzle"
import { users } from "$lib/db/schema"
import { eq } from "drizzle-orm"
import type { Session } from "$lib/compat/next-auth"

export interface UserVerificationResult {
  exists: boolean
  user?: {
    id: string
    email: string
    name: string | null
    image: string | null
    emailVerified: Date | null
  }
  created?: boolean
}

/**
 * Ensures a user exists in the database for a given session.
 * If the user doesn't exist, creates them from session data.
 *
 * @param session - NextAuth session object
 * @returns Promise<UserVerificationResult> - Result indicating if user exists or was created
 */
export async function ensureUserExists(
  session: Session,
): Promise<UserVerificationResult> {
  if (!session?.user?.id || !session?.user?.email) {
    throw new Error("Invalid session: missing user ID or email")
  }

  const userId = session.user.id
  const userEmail = session.user.email.toLowerCase().trim()

  try {
    const db = await getDatabase()
    // Check if user exists by ID first (primary lookup)
    const existingUserById = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (existingUserById.length > 0) {
      return {
        exists: true,
        user: existingUserById[0],
      }
    }

    // Check if user exists by email (fallback for email-based lookup)
    const existingUserByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1)

    if (existingUserByEmail.length > 0) {
      return {
        exists: true,
        user: existingUserByEmail[0],
      }
    }

    // User doesn't exist, create them from session data
    const newUserData = {
      id: userId,
      email: userEmail,
      name: session.user.name || null,
      image: session.user.image || null,
      emailVerified: (session.user as any).email_verified ? new Date() : null, // For OAuth users
      password: null, // OAuth users don't have passwords
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const insertResult = await db.insert(users).values(newUserData).returning()

    console.log("[UserVerification] Created new user from session:", {
      userId,
      email: userEmail,
      name: newUserData.name,
    })

    return {
      exists: false,
      user: insertResult[0],
      created: true,
    }
  } catch (error) {
    console.error("[UserVerification] Error ensuring user exists:", error)
    throw new Error(
      `Failed to verify or create user: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    )
  }
}

/**
 * Verifies that a user exists in the database for a given user ID.
 * Does not create the user if they don't exist.
 *
 * @param userId - User ID to verify
 * @returns Promise<UserVerificationResult> - Result indicating if user exists
 */
export async function verifyUserExists(
  userId: string,
): Promise<UserVerificationResult> {
  if (!userId) {
    throw new Error("User ID is required")
  }

  try {
    const db = await getDatabase()
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (existingUser.length > 0) {
      return {
        exists: true,
        user: existingUser[0],
      }
    }

    return {
      exists: false,
    }
  } catch (error) {
    console.error("[UserVerification] Error verifying user exists:", error)
    throw new Error(
      `Failed to verify user existence: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    )
  }
}
