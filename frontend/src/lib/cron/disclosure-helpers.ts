import { eq } from "drizzle-orm"
import { disclosureLog } from "@/lib/db/schema"

export async function updateDisclosureLog(
  db: any,
  logId: string,
  status: "sent" | "failed",
  error?: string,
): Promise<boolean> {
  try {
    const now = new Date()
    const updates: Record<string, unknown> = {
      status,
      updatedAt: now,
    }

    if (status === "sent") {
      updates.sentAt = now
    }

    if (error) {
      updates.error = error
    }

    await db
      .update(disclosureLog)
      .set(updates)
      .where(eq(disclosureLog.id, logId))

    return true
  } catch (error) {
    console.error(`Failed to update disclosure log ${logId}:`, error)
    return false
  }
}

export function shouldRetrySecret(retryCount: number): boolean {
  const MAX_RETRIES = 5
  return retryCount < MAX_RETRIES
}
