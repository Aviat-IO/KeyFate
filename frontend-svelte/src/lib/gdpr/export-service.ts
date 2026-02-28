import { getDatabase } from "$lib/db/get-database"
import {
  users,
  secrets,
  secretRecipients,
  checkinHistory,
  auditLogs,
  userSubscriptions,
  paymentHistory,
  dataExportJobs,
  ExportJobStatus,
} from "$lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { Storage } from "@google-cloud/storage"

const storage = new Storage()
const EXPORT_BUCKET = process.env.EXPORT_BUCKET || "keyfate-exports-dev"
const EXPORT_EXPIRY_HOURS = 24

export interface UserDataExport {
  exportedAt: string
  user: {
    id: string
    email: string
    name: string | null
    emailVerified: Date | null
    createdAt: Date
  }
  secrets: Array<{
    id: string
    title: string
    serverShare: string | null
    checkInDays: number
    status: string
    createdAt: Date
    lastCheckIn: Date | null
    nextCheckIn: Date | null
    recipients: Array<{
      name: string
      email: string | null
      phone: string | null
    }>
  }>
  checkIns: Array<{
    secretId: string
    timestamp: Date
    ipAddress: string | null
  }>
  auditLogs: Array<{
    eventType: string
    category: string
    timestamp: Date
    metadata: Record<string, unknown> | null
  }>
  subscription: {
    tier: string
    status: string
    startDate: Date | null
    endDate: Date | null
  } | null
  paymentHistory: Array<{
    transactionId: string
    amount: string
    currency: string
    status: string
    createdAt: Date
  }>
}

/**
 * Generate a complete export of all user data
 */
export async function generateUserDataExport(
  userId: string,
): Promise<UserDataExport> {
  const db = await getDatabase()
  // Fetch user profile
  const [user] = await db.select().from(users).where(eq(users.id, userId))

  if (!user) {
    throw new Error("User not found")
  }

  // Fetch all secrets with recipients and server shares
  const userSecrets = await db
    .select()
    .from(secrets)
    .where(eq(secrets.userId, userId))

  const secretsWithDetails = await Promise.all(
    userSecrets.map(async (secret) => {
      // Get recipients for this secret
      const recipients = await db
        .select()
        .from(secretRecipients)
        .where(eq(secretRecipients.secretId, secret.id))

      return {
        id: secret.id,
        title: secret.title,
        serverShare: secret.serverShare,
        checkInDays: secret.checkInDays,
        status: secret.status,
        createdAt: secret.createdAt,
        lastCheckIn: secret.lastCheckIn,
        nextCheckIn: secret.nextCheckIn,
        recipients: recipients.map((r) => ({
          name: r.name,
          email: r.email,
          phone: r.phone,
        })),
      }
    }),
  )

  // Fetch check-in history
  const userCheckIns = await db
    .select()
    .from(checkinHistory)
    .where(eq(checkinHistory.userId, userId))
    .orderBy(desc(checkinHistory.checkedInAt))

  // Fetch audit logs
  const userAuditLogs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))

  // Fetch subscription info
  const [subscription] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))

  // Fetch payment history (metadata only, no card details)
  const payments = await db
    .select()
    .from(paymentHistory)
    .where(eq(paymentHistory.userId, userId))
    .orderBy(desc(paymentHistory.createdAt))

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
    secrets: secretsWithDetails,
    checkIns: userCheckIns.map((c) => ({
      secretId: c.secretId,
      timestamp: c.checkedInAt,
      ipAddress: null, // Not stored in schema
    })),
    auditLogs: userAuditLogs.map((log) => ({
      eventType: log.eventType,
      category: log.eventCategory,
      timestamp: log.createdAt,
      metadata: (log.details as Record<string, unknown>) || {},
    })),
    subscription: subscription
      ? {
          tier: subscription.tierId,
          status: subscription.status,
          startDate: subscription.currentPeriodStart,
          endDate: subscription.currentPeriodEnd,
        }
      : null,
    paymentHistory: payments.map((p) => ({
      transactionId: p.providerPaymentId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
    })),
  }
}

/**
 * Upload export file to Cloud Storage and return signed URL
 */
export async function uploadExportFile(
  userId: string,
  exportData: UserDataExport,
): Promise<{ fileUrl: string; fileSize: number }> {
  const fileName = `exports/${userId}/${Date.now()}.json`
  const file = storage.bucket(EXPORT_BUCKET).file(fileName)

  const jsonContent = JSON.stringify(exportData, null, 2)
  const fileSize = Buffer.byteLength(jsonContent, "utf8")

  // Upload file
  await file.save(jsonContent, {
    contentType: "application/json",
    metadata: {
      userId,
      exportedAt: exportData.exportedAt,
    },
  })

  // Generate signed URL with 24-hour expiration
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + EXPORT_EXPIRY_HOURS * 60 * 60 * 1000,
  })

  return {
    fileUrl: signedUrl,
    fileSize,
  }
}

/**
 * Record export job in database
 */
export async function recordExportJob(
  userId: string,
  fileUrl: string,
  fileSize: number,
) {
  const db = await getDatabase()
  const expiresAt = new Date(Date.now() + EXPORT_EXPIRY_HOURS * 60 * 60 * 1000)

  const [job] = await db
    .insert(dataExportJobs)
    .values({
      userId,
      status: ExportJobStatus.COMPLETED,
      fileUrl,
      fileSize,
      expiresAt,
      completedAt: new Date(),
    })
    .returning()

  return job
}

/**
 * Check if user has a recent export request (within 24 hours)
 */
export async function hasRecentExportRequest(userId: string): Promise<boolean> {
  const db = await getDatabase()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [recentJob] = await db
    .select()
    .from(dataExportJobs)
    .where(
      and(
        eq(dataExportJobs.userId, userId),
        // Check if created within last 24 hours
      ),
    )
    .orderBy(desc(dataExportJobs.createdAt))
    .limit(1)

  return recentJob ? recentJob.createdAt > oneDayAgo : false
}

/**
 * Create a pending export job
 */
export async function createPendingExportJob(userId: string) {
  const db = await getDatabase()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const [job] = await db
    .insert(dataExportJobs)
    .values({
      userId,
      status: ExportJobStatus.PENDING,
      expiresAt,
    })
    .returning()

  return job
}

/**
 * Get export job by ID
 */
export async function getExportJob(jobId: string) {
  const db = await getDatabase()
  const [job] = await db
    .select()
    .from(dataExportJobs)
    .where(eq(dataExportJobs.id, jobId))

  return job
}

/**
 * Increment download count for export job
 */
export async function incrementDownloadCount(jobId: string) {
  const db = await getDatabase()

  // Get current count
  const [job] = await db
    .select()
    .from(dataExportJobs)
    .where(eq(dataExportJobs.id, jobId))

  if (!job) {
    throw new Error("Export job not found")
  }

  // Increment count
  await db
    .update(dataExportJobs)
    .set({
      downloadCount: (job.downloadCount || 0) + 1,
    })
    .where(eq(dataExportJobs.id, jobId))
}
