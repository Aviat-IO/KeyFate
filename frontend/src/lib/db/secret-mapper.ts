export type ApiSecret = {
  id: string;
  user_id: string;
  title: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  contact_method: "email" | "phone" | "both";
  check_in_days: number;
  status: "active" | "paused" | "triggered";
  server_share: string | null;
  iv: string | null;
  auth_tag: string | null;
  sss_shares_total: number;
  sss_threshold: number;
  is_triggered: boolean;
  last_check_in: string | null;
  next_check_in: string | null;
  triggered_at: string | null;
  created_at: string;
  updated_at: string;
};

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  try {
    return new Date(value as any).toISOString();
  } catch {
    return null;
  }
}

export function mapDrizzleSecretToApiShape(row: any): ApiSecret {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    recipient_name: row.recipientName,
    recipient_email: row.recipientEmail ?? null,
    recipient_phone: row.recipientPhone ?? null,
    contact_method: row.contactMethod,
    check_in_days: row.checkInDays,
    status: row.status,
    server_share: row.serverShare ?? null,
    iv: row.iv ?? null,
    auth_tag: row.authTag ?? null,
    sss_shares_total: row.sssSharesTotal,
    sss_threshold: row.sssThreshold,
    is_triggered: row.isTriggered ?? false,
    last_check_in: toIsoString(row.lastCheckIn),
    next_check_in: toIsoString(row.nextCheckIn),
    triggered_at: toIsoString(row.triggeredAt),
    created_at: toIsoString(row.createdAt)!,
    updated_at: toIsoString(row.updatedAt)!,
  };
}

export function mapApiSecretToDrizzleShape(apiSecret: ApiSecret): any {
  return {
    id: apiSecret.id,
    userId: apiSecret.user_id,
    title: apiSecret.title,
    recipientName: apiSecret.recipient_name,
    recipientEmail: apiSecret.recipient_email,
    recipientPhone: apiSecret.recipient_phone,
    contactMethod: apiSecret.contact_method,
    checkInDays: apiSecret.check_in_days,
    status: apiSecret.status,
    serverShare: apiSecret.server_share,
    iv: apiSecret.iv,
    authTag: apiSecret.auth_tag,
    sssSharesTotal: apiSecret.sss_shares_total,
    sssThreshold: apiSecret.sss_threshold,
    isTriggered: apiSecret.is_triggered,
    lastCheckIn: apiSecret.last_check_in ? new Date(apiSecret.last_check_in) : null,
    nextCheckIn: apiSecret.next_check_in ? new Date(apiSecret.next_check_in) : null,
    triggeredAt: apiSecret.triggered_at ? new Date(apiSecret.triggered_at) : null,
    createdAt: new Date(apiSecret.created_at),
    updatedAt: new Date(apiSecret.updated_at),
  };
}
