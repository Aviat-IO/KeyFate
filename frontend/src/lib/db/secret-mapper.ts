import type { SecretWithRecipients } from "@/lib/types/secret-types"

export type ApiSecret = {
  id: string
  user_id: string
  title: string
  recipients: Array<{
    id: string
    name: string
    email: string | null
    phone: string | null
  }>
  check_in_days: number
  status: "active" | "paused" | "triggered"
  server_share: string | null
  iv: string | null
  auth_tag: string | null
  sss_shares_total: number
  sss_threshold: number
  is_triggered: boolean
  last_check_in: string | null
  next_check_in: string | null
  triggered_at: string | null
  created_at: string
  updated_at: string
}

type DateLike = Date | string | number | null | undefined

function toIsoString(value: DateLike): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  if (value instanceof Date) return value.toISOString()
  try {
    return new Date(value).toISOString()
  } catch {
    return null
  }
}

export function mapDrizzleSecretToApiShape(
  row: SecretWithRecipients,
): ApiSecret {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    recipients: row.recipients.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email ?? null,
      phone: r.phone ?? null,
    })),
    check_in_days: row.checkInDays,
    status: row.status,
    server_share: row.serverShare ?? null,
    iv: row.iv ?? null,
    auth_tag: row.authTag ?? null,
    sss_shares_total: row.sssSharesTotal,
    sss_threshold: row.sssThreshold,
    is_triggered: row.triggeredAt !== null || row.status === "triggered",
    last_check_in: toIsoString(row.lastCheckIn),
    next_check_in: toIsoString(row.nextCheckIn),
    triggered_at: toIsoString(row.triggeredAt),
    created_at: toIsoString(row.createdAt)!,
    updated_at: toIsoString(row.updatedAt)!,
  }
}

export function mapApiSecretToDrizzleShape(
  apiSecret: ApiSecret,
): SecretWithRecipients {
  return {
    id: apiSecret.id,
    userId: apiSecret.user_id,
    title: apiSecret.title,
    recipients: apiSecret.recipients.map((r) => ({
      id: r.id,
      secretId: apiSecret.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    checkInDays: apiSecret.check_in_days,
    status: apiSecret.status,
    serverShare: apiSecret.server_share,
    iv: apiSecret.iv,
    authTag: apiSecret.auth_tag,
    sssSharesTotal: apiSecret.sss_shares_total,
    sssThreshold: apiSecret.sss_threshold,
    lastCheckIn: apiSecret.last_check_in
      ? new Date(apiSecret.last_check_in)
      : null,
    nextCheckIn: apiSecret.next_check_in
      ? new Date(apiSecret.next_check_in)
      : null,
    triggeredAt: apiSecret.triggered_at
      ? new Date(apiSecret.triggered_at)
      : null,
    processingStartedAt: null,
    lastError: null,
    createdAt: new Date(apiSecret.created_at),
    updatedAt: new Date(apiSecret.updated_at),
  }
}
