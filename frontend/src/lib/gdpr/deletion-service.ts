import { getDatabase } from "@/lib/db/get-database"
import {
  users,
  secrets,
  secretRecipients,
  checkinHistory,
  auditLogs,
  dataExportJobs,
  otpRateLimits,
  webhookEvents,
  userSubscriptions,
  accountDeletionRequests,
  sessions,
  accounts,
  verificationTokens,
  passwordResetTokens,
  emailFailures,
  DeletionRequestStatus,
} from "@/lib/db/schema"
import { eq, and, lt } from "drizzle-orm"
import { randomBytes } from "crypto"
import { sendEmail } from "@/lib/email/email-service"

const GRACE_PERIOD_DAYS = 30

/**
 * Generate a secure confirmation token
 */
function generateConfirmationToken(): string {
  return randomBytes(32).toString("hex")
}

/**
 * Initiate account deletion request
 */
export async function initiateAccountDeletion(userId: string) {
  const db = await getDatabase()
  const confirmationToken = generateConfirmationToken()
  const scheduledDeletionAt = new Date(
    Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  )

  // Create deletion request
  const [request] = await db
    .insert(accountDeletionRequests)
    .values({
      userId,
      status: DeletionRequestStatus.PENDING,
      confirmationToken,
      scheduledDeletionAt,
    })
    .returning()

  // Get user email for notification
  const [user] = await db.select().from(users).where(eq(users.id, userId))

  if (!user) {
    throw new Error("User not found")
  }

  // Send confirmation email
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  await sendEmail({
    to: user.email,
    subject: "Confirm Your Account Deletion Request",
    html: `
      <p>You have requested to delete your KeyFate account.</p>
      <p>To confirm this request, please click the link below:</p>
      <p><a href="${baseUrl}/confirm-deletion?token=${confirmationToken}">Confirm Account Deletion</a></p>
      <p>After confirmation, there will be a ${GRACE_PERIOD_DAYS}-day grace period until ${scheduledDeletionAt.toLocaleDateString()}.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  })

  return request
}

/**
 * Confirm account deletion request
 */
export async function confirmAccountDeletion(token: string) {
  const db = await getDatabase()
  const [request] = await db
    .select()
    .from(accountDeletionRequests)
    .where(eq(accountDeletionRequests.confirmationToken, token))

  if (!request) {
    throw new Error("Invalid confirmation token")
  }

  if (request.status !== "pending") {
    throw new Error("Deletion request already processed")
  }

  // Update request status
  const [updatedRequest] = await db
    .update(accountDeletionRequests)
    .set({
      status: DeletionRequestStatus.CONFIRMED,
      confirmedAt: new Date(),
    })
    .where(eq(accountDeletionRequests.id, request.id))
    .returning()

  // Get user for notification
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, request.userId))

  if (user) {
    // Send grace period started email
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000"
    await sendEmail({
      to: user.email,
      subject: "Your Account Will Be Deleted in 30 Days",
      html: `
        <p>Your account deletion request has been confirmed.</p>
        <p>Your account will be permanently deleted on ${request.scheduledDeletionAt?.toLocaleDateString()}.</p>
        <p>If you change your mind, you can cancel this request by visiting:</p>
        <p><a href="${baseUrl}/settings/privacy">Cancel Account Deletion</a></p>
        <p>After the scheduled date, all your data will be permanently removed and cannot be recovered.</p>
      `,
    })
  }

  return updatedRequest
}

/**
 * Cancel account deletion request
 */
export async function cancelAccountDeletion(requestId: string, userId: string) {
  const db = await getDatabase()
  const [request] = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.id, requestId),
        eq(accountDeletionRequests.userId, userId),
      ),
    )

  if (!request) {
    throw new Error("Deletion request not found")
  }

  if (request.status !== "pending" && request.status !== "confirmed") {
    throw new Error("Cannot cancel this deletion request")
  }

  // Update request status
  await db
    .update(accountDeletionRequests)
    .set({
      status: DeletionRequestStatus.CANCELLED,
      cancelledAt: new Date(),
    })
    .where(eq(accountDeletionRequests.id, requestId))

  // Get user for notification
  const [user] = await db.select().from(users).where(eq(users.id, userId))

  if (user) {
    // Send cancellation confirmation email
    await sendEmail({
      to: user.email,
      subject: "Account Deletion Cancelled",
      html: `
        <p>Hello ${user.name || user.email},</p>
        <p>Your account deletion request has been cancelled.</p>
        <p>Your account and all your data remain active and secure.</p>
        <p>If you did not cancel this request, please contact support immediately.</p>
      `,
    })
  }
}

/**
 * Execute account deletion (called by cron job)
 */
export async function executeAccountDeletion(userId: string) {
  const db = await getDatabase()
  // Get user email before deletion
  const [user] = await db.select().from(users).where(eq(users.id, userId))

  if (!user) {
    throw new Error("User not found")
  }

  try {
    // Delete all user data in correct order (respecting foreign key constraints)

    // Get user email for cleaning up email failures
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const userEmail = user[0]?.email

    // 1. Delete email failures (by recipient email, not userId)
    if (userEmail) {
      await db
        .delete(emailFailures)
        .where(eq(emailFailures.recipient, userEmail))
    }

    // 2. Delete recipients (foreign key to secrets)
    const userSecrets = await db
      .select()
      .from(secrets)
      .where(eq(secrets.userId, userId))
    const secretIds = userSecrets.map((s) => s.id)

    if (secretIds.length > 0) {
      for (const secretId of secretIds) {
        await db
          .delete(secretRecipients)
          .where(eq(secretRecipients.secretId, secretId))
      }
    }

    // 3. Delete secrets
    await db.delete(secrets).where(eq(secrets.userId, userId))

    // 4. Delete check-ins
    await db.delete(checkinHistory).where(eq(checkinHistory.userId, userId))

    // 5. Delete audit logs
    await db.delete(auditLogs).where(eq(auditLogs.userId, userId))

    // 6. Delete export jobs
    await db.delete(dataExportJobs).where(eq(dataExportJobs.userId, userId))

    // 7. Delete OTP rate limits
    if (userEmail) {
      await db.delete(otpRateLimits).where(eq(otpRateLimits.email, userEmail))
    }

    // 8. Webhook events don't have userId - skip (system-level logs)

    // 9. Anonymize subscription (keep for financial records)
    await db
      .update(userSubscriptions)
      .set({
        // Keep subscription record but anonymize user reference
        userId: "deleted-user",
      })
      .where(eq(userSubscriptions.userId, userId))

    // 10. Delete sessions
    await db.delete(sessions).where(eq(sessions.userId, userId))

    // 11. Delete accounts
    await db.delete(accounts).where(eq(accounts.userId, userId))

    // 12. Delete verification tokens
    if (userEmail) {
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, userEmail))
    }

    // 13. Delete password reset tokens (if any)
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId))

    // 14. Delete user record (this cascades to remaining dependent records)
    await db.delete(users).where(eq(users.id, userId))

    // 15. Mark deletion request as completed
    await db
      .update(accountDeletionRequests)
      .set({
        status: DeletionRequestStatus.COMPLETED,
        deletedAt: new Date(),
      })
      .where(eq(accountDeletionRequests.userId, userId))

    // Send deletion confirmation email (before user is deleted)
    if (userEmail) {
      const userName = user[0]?.name
      await sendEmail({
        to: userEmail,
        subject: "Your Account Has Been Deleted",
        html: `
          <p>Hello ${userName || userEmail},</p>
          <p>Your account has been permanently deleted as requested.</p>
          <p>All your data has been removed from our systems.</p>
          <p>Thank you for using our service.</p>
        `,
      })
    }

    return true
  } catch (error) {
    console.error("Error executing account deletion:", error)
    throw error
  }
}

/**
 * Get pending deletions that are past grace period
 */
export async function getPendingDeletions() {
  const db = await getDatabase()
  const now = new Date()

  const pendingDeletions = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.status, DeletionRequestStatus.CONFIRMED),
        lt(accountDeletionRequests.scheduledDeletionAt, now),
      ),
    )

  return pendingDeletions
}

/**
 * Get active deletion request for user
 */
export async function getActiveDeletionRequest(userId: string) {
  const db = await getDatabase()
  const [request] = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.userId, userId),
        // Status is pending or confirmed (not cancelled or completed)
      ),
    )
    .orderBy(accountDeletionRequests.createdAt)
    .limit(1)

  // Filter for active statuses
  if (
    request &&
    (request.status === "pending" || request.status === "confirmed")
  ) {
    return request
  }

  return null
}
