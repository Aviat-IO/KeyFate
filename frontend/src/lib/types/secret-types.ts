import { secrets, secretRecipients } from "@/lib/db/schema"
import type { InferSelectModel } from "drizzle-orm"

export type Secret = InferSelectModel<typeof secrets>
export type SecretRecipient = InferSelectModel<typeof secretRecipients>
export type SecretInsert = typeof secrets.$inferInsert
export type SecretRecipientInsert = typeof secretRecipients.$inferInsert

export interface SecretWithRecipients extends Secret {
  recipients: SecretRecipient[]
}

export type RecipientInput = {
  name: string
  email?: string | null
  phone?: string | null
}

export type RecipientUpdateInput = Omit<
  SecretRecipientInsert,
  "secretId" | "id" | "createdAt" | "updatedAt"
>

export function getRecipientContactInfo(recipient: SecretRecipient): string {
  return recipient.email || recipient.phone || ""
}
