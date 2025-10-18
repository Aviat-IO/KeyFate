import crypto from "crypto"
import { getDatabase } from "@/lib/db/drizzle"
import { passwordResetTokens, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function generatePasswordResetToken(
  userId: string,
): Promise<string> {
  const db = await getDatabase()
  const token = crypto.randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 60 * 60 * 1000)

  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, userId))

  await db.insert(passwordResetTokens).values({
    userId,
    token,
    expires,
  })

  return token
}

export async function validatePasswordResetToken(token: string): Promise<{
  isValid: boolean
  userId?: string
  error?: string
}> {
  const db = await getDatabase()
  const resetTokens = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1)

  if (resetTokens.length === 0) {
    return { isValid: false, error: "Invalid token" }
  }

  const resetToken = resetTokens[0]

  if (new Date() > resetToken.expires) {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, resetToken.id))
    return { isValid: false, error: "Token expired" }
  }

  return { isValid: true, userId: resetToken.userId }
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  const db = await getDatabase()
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
}

export async function canRequestPasswordReset(email: string): Promise<{
  canReset: boolean
  error?: string
}> {
  const db = await getDatabase()
  const userResults = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (userResults.length === 0) {
    return { canReset: false }
  }

  const user = userResults[0]

  if (!user.password) {
    return {
      canReset: false,
      error: "OAuth-only accounts cannot reset password",
    }
  }

  if (!user.emailVerified) {
    return { canReset: false, error: "Email not verified" }
  }

  return { canReset: true }
}
