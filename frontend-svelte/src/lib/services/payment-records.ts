/**
 * Payment Record Management
 *
 * Functions for creating and querying payment history records.
 * Extracted from subscription-service.ts for maintainability.
 */

import { getDatabase } from "$lib/db/drizzle"
import { paymentHistory } from "$lib/db/schema"
import { logSubscriptionChanged } from "$lib/services/audit-logger"
import { logger } from "$lib/logger"
import type { SubscriptionProvider } from "./subscription-service.types"

export interface CreatePaymentRecordData {
  userId: string
  subscriptionId?: string
  provider: SubscriptionProvider
  providerPaymentId: string
  amount: number
  currency?: string
  status: "succeeded" | "failed" | "pending" | "refunded"
  failureReason?: string
  metadata?: Record<string, unknown>
}

/**
 * Insert a payment record and log the event to the audit trail.
 */
export async function createPaymentRecord(data: CreatePaymentRecordData) {
  const db = await getDatabase()
  try {
    const [payment] = await db
      .insert(paymentHistory)
      .values({
        userId: data.userId,
        subscriptionId: data.subscriptionId || null,
        provider: data.provider,
        providerPaymentId: data.providerPaymentId,
        amount: data.amount.toString(),
        currency: data.currency || "USD",
        status: data.status,
        failureReason: data.failureReason || null,
        metadata: data.metadata || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning()

    await logSubscriptionChanged(data.userId, {
      action: "payment_processed",
      provider: data.provider,
      amount: data.amount,
      status: data.status,
      paymentId: data.providerPaymentId,
      resourceType: "payment",
      resourceId: `${data.provider}:${data.providerPaymentId}`,
    })

    return payment
  } catch (error) {
    logger.error(
      "Failed to create payment record",
      error instanceof Error ? error : undefined,
      { provider: data.provider, status: data.status },
    )
    throw error
  }
}
