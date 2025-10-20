import { getDatabase } from "@/lib/db/drizzle"
import { auditLogs, type AuditLogInsert } from "@/lib/db/schema"
import { headers } from "next/headers"

export type AuditEventType =
  | "secret_created"
  | "secret_edited"
  | "secret_deleted"
  | "check_in"
  | "secret_triggered"
  | "recipient_added"
  | "recipient_removed"
  | "settings_changed"
  | "login"
  | "subscription_changed"

export type AuditEventCategory =
  | "secrets"
  | "authentication"
  | "subscriptions"
  | "settings"
  | "recipients"

interface AuditLogParams {
  userId: string
  eventType: AuditEventType
  eventCategory: AuditEventCategory
  resourceType?: string
  resourceId?: string
  details?: Record<string, unknown>
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const db = await getDatabase()
    const headersList = await headers()

    const ipAddress =
      headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || null
    const userAgent = headersList.get("user-agent") || null

    const logEntry = {
      userId: params.userId,
      eventType: params.eventType,
      eventCategory: params.eventCategory,
      ...(params.resourceType && { resourceType: params.resourceType }),
      ...(params.resourceId && { resourceId: params.resourceId }),
      ...(params.details && { details: params.details }),
      ...(ipAddress && { ipAddress }),
      ...(userAgent && { userAgent }),
    }

    await db.insert(auditLogs).values(logEntry as AuditLogInsert)
  } catch (error) {
    console.error("[Audit Logger] Failed to log audit event:", error)
  }
}

export async function logSecretCreated(
  userId: string,
  secretId: string,
  details?: Record<string, unknown>,
) {
  await logAudit({
    userId,
    eventType: "secret_created",
    eventCategory: "secrets",
    resourceType: "secret",
    resourceId: secretId,
    details,
  })
}

export async function logSecretEdited(
  userId: string,
  secretId: string,
  details?: Record<string, unknown>,
) {
  await logAudit({
    userId,
    eventType: "secret_edited",
    eventCategory: "secrets",
    resourceType: "secret",
    resourceId: secretId,
    details,
  })
}

export async function logSecretDeleted(
  userId: string,
  secretId: string,
  details?: Record<string, unknown>,
) {
  await logAudit({
    userId,
    eventType: "secret_deleted",
    eventCategory: "secrets",
    resourceType: "secret",
    resourceId: secretId,
    details,
  })
}

export async function logCheckIn(
  userId: string,
  secretId: string,
  details?: Record<string, unknown>,
) {
  await logAudit({
    userId,
    eventType: "check_in",
    eventCategory: "secrets",
    resourceType: "secret",
    resourceId: secretId,
    details,
  })
}

export async function logSecretTriggered(
  userId: string,
  secretId: string,
  details?: Record<string, unknown>,
) {
  await logAudit({
    userId,
    eventType: "secret_triggered",
    eventCategory: "secrets",
    resourceType: "secret",
    resourceId: secretId,
    details,
  })
}

export async function logRecipientAdded(
  userId: string,
  secretId: string,
  recipientId: string,
  details?: Record<string, unknown>,
) {
  await logAudit({
    userId,
    eventType: "recipient_added",
    eventCategory: "recipients",
    resourceType: "recipient",
    resourceId: recipientId,
    details: { ...details, secretId },
  })
}

export async function logRecipientRemoved(
  userId: string,
  secretId: string,
  recipientId: string,
  details?: Record<string, unknown>,
) {
  await logAudit({
    userId,
    eventType: "recipient_removed",
    eventCategory: "recipients",
    resourceType: "recipient",
    resourceId: recipientId,
    details: { ...details, secretId },
  })
}

export async function logLogin(userId: string, details?: Record<string, unknown>) {
  await logAudit({
    userId,
    eventType: "login",
    eventCategory: "authentication",
    details,
  })
}

export async function logSubscriptionChanged(
  userId: string,
  details?: Record<string, unknown>,
) {
  await logAudit({
    userId,
    eventType: "subscription_changed",
    eventCategory: "subscriptions",
    details,
  })
}

export async function logSettingsChanged(
  userId: string,
  details?: Record<string, unknown>,
) {
  await logAudit({
    userId,
    eventType: "settings_changed",
    eventCategory: "settings",
    details,
  })
}
