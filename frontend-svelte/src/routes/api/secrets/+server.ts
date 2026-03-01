import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"
import { requireEmailVerification } from "$lib/auth/require-email-verification"
import { requireCSRFProtection, createCSRFErrorResponse } from "$lib/csrf"
import { encryptMessage } from "$lib/encryption"
import { secretSchema } from "$lib/schemas/secret"
import {
  canUserCreateSecret,
  getUserTierInfo,
  isIntervalAllowed,
} from "$lib/subscription"
import { isValidThreshold } from "$lib/tier-validation"
import { logSecretCreated } from "$lib/services/audit-logger"
import { scheduleRemindersForSecret } from "$lib/services/reminder-scheduler"
import {
  checkRateLimit,
  getRateLimitHeaders,
} from "$lib/rate-limit"
import { APIError, handleAPIError } from "$lib/errors/api-error"
import { ZodError } from "zod"
import { getAllSecretsWithRecipients } from "$lib/db/queries/secrets"
import { mapDrizzleSecretToApiShape } from "$lib/db/secret-mapper"
import { npubToHex, isValidNpub } from "$lib/nostr/keypair"

export const GET: RequestHandler = async (event) => {
  try {
    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    const secrets = await getAllSecretsWithRecipients(session.user.id)
    const mapped = secrets.map(mapDrizzleSecretToApiShape)

    return json(mapped)
  } catch (error) {
    console.error("Error fetching secrets:", error)
    return json({ error: "Internal server error" }, { status: 500 })
  }
}

export const POST: RequestHandler = async (event) => {
  let insertData: Record<string, unknown> | undefined

  try {
    const csrfCheck = await requireCSRFProtection(event)
    if (!csrfCheck.valid) {
      return createCSRFErrorResponse()
    }

    const session = await event.locals.auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensures user exists in DB (creates for OAuth users) and checks email verification
    const emailVerificationError = await requireEmailVerification(session as any)
    if (emailVerificationError) {
      return emailVerificationError
    }

    const rateLimitResult = await checkRateLimit(
      "secretCreation",
      session.user.id,
      5,
    )
    if (!rateLimitResult.success) {
      return new Response(
        JSON.stringify({
          error: "Too many secrets created. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...getRateLimitHeaders(rateLimitResult),
          },
        },
      )
    }

    const canCreate = await canUserCreateSecret(session.user.id)
    if (!canCreate) {
      const tierInfo = await getUserTierInfo(session.user.id)
      const tierName = tierInfo?.tier?.tiers?.name ?? "free"
      const maxSecrets = tierInfo?.tier?.tiers?.max_secrets ?? 1
      throw APIError.businessRule(
        `Secret limit reached. Your ${tierName} tier allows ${maxSecrets} secret${maxSecrets === 1 ? "" : "s"}. Upgrade to Pro for more.`,
        {
          tier: tierName,
          limit: maxSecrets,
          upgradeUrl: "/pricing",
        },
      )
    }

    const body = await event.request.json()

    let validatedData
    try {
      validatedData = secretSchema.parse(body)
    } catch (error) {
      if (error instanceof ZodError) {
        throw APIError.validation("Invalid secret data", {
          errors: error.issues.map((err) => ({
            path: (err.path as (string | number)[]).join("."),
            message: err.message,
          })),
        })
      }
      throw APIError.validation("Invalid request data")
    }

    const tierInfo = await getUserTierInfo(session.user.id)
    const userTier = (tierInfo?.tier?.tiers?.name ?? "free") as "free" | "pro"
    const maxRecipients = tierInfo?.tier?.tiers?.max_recipients_per_secret ?? 1

    if (!isIntervalAllowed(userTier, validatedData.check_in_days)) {
      throw APIError.businessRule(
        `Check-in interval of ${validatedData.check_in_days} days is not allowed for your tier. Upgrade to Pro for custom intervals.`,
        {
          tier: userTier,
          requestedInterval: validatedData.check_in_days,
          upgradeUrl: "/pricing",
        },
      )
    }

    if (validatedData.recipients.length > maxRecipients) {
      return json(
        {
          error: `Recipient limit exceeded. Your ${userTier} tier allows ${maxRecipients} recipient${maxRecipients === 1 ? "" : "s"} per secret. Upgrade to Pro for more.`,
          code: "RECIPIENT_LIMIT_EXCEEDED",
        },
        { status: 403 },
      )
    }

    if (
      !isValidThreshold(
        userTier,
        validatedData.sss_threshold,
        validatedData.sss_shares_total,
      )
    ) {
      const maxShares = userTier === "pro" ? 7 : 3
      return json(
        {
          error: `Invalid threshold configuration. ${userTier === "free" ? "Free tier is limited to 2-of-3 shares. Upgrade to Pro for configurable thresholds up to 7 shares." : `Pro tier allows 2-of-N up to ${maxShares} shares.`}`,
          code: "THRESHOLD_NOT_ALLOWED",
        },
        { status: 403 },
      )
    }

    // Encrypt the server share before storing (only if not already provided)
    let encryptedServerShare: string
    let iv: string
    let authTag: string

    if (validatedData.iv && validatedData.auth_tag) {
      // Use provided encrypted data (for testing/backward compatibility)
      encryptedServerShare = validatedData.server_share
      iv = validatedData.iv
      authTag = validatedData.auth_tag
    } else {
      // Encrypt the plain server share
      const encrypted = await encryptMessage(validatedData.server_share)
      encryptedServerShare = encrypted.encrypted
      iv = encrypted.iv
      authTag = encrypted.authTag
    }

    // Create secret without recipients (they'll be added separately)
    insertData = {
      title: validatedData.title,
      checkInDays: validatedData.check_in_days,
      serverShare: encryptedServerShare,
      iv: iv,
      authTag: authTag,
      userId: session.user.id,
      sssSharesTotal: validatedData.sss_shares_total,
      sssThreshold: validatedData.sss_threshold,
      status: "active" as const,
      nextCheckIn: new Date(
        Date.now() + validatedData.check_in_days * 24 * 60 * 60 * 1000,
      ),
    }

    console.log("Insert data structure:", JSON.stringify(insertData, null, 2))

    // Create the secret and recipients in a transaction to ensure atomicity
    const db = await import("$lib/db/drizzle").then((m) => m.getDatabase())
    const { secrets: secretsTable, secretRecipients } = await import(
      "$lib/db/schema"
    )

    const data = await db.transaction(async (tx) => {
      // Insert the secret
      const [newSecret] = await tx
        .insert(secretsTable)
        .values(insertData as any)
        .returning()

      // Build a lookup of email -> hex nostr pubkey from the optional recipient_nostr_pubkeys
      const nostrPubkeyByEmail = new Map<string, string>()
      if (validatedData.recipient_nostr_pubkeys) {
        for (const entry of validatedData.recipient_nostr_pubkeys) {
          if (entry.email && entry.npub && isValidNpub(entry.npub)) {
            try {
              nostrPubkeyByEmail.set(entry.email, npubToHex(entry.npub))
            } catch {
              // Skip invalid npubs silently
            }
          }
        }
      }

      // Insert recipients - this MUST succeed or the entire transaction rolls back
      const insertedRecipients = await tx
        .insert(secretRecipients)
        .values(
          validatedData.recipients.map((recipient) => ({
            secretId: newSecret.id,
            name: recipient.name,
            email: recipient.email,
            nostrPubkey: recipient.email
              ? (nostrPubkeyByEmail.get(recipient.email) ?? null)
              : null,
          })),
        )
        .returning()

      return { secret: newSecret, recipients: insertedRecipients }
    })

    await logSecretCreated(session.user.id, data.secret.id, {
      title: validatedData.title,
      recipientCount: validatedData.recipients.length,
      checkInDays: validatedData.check_in_days,
    })

    await scheduleRemindersForSecret(
      data.secret.id,
      data.secret.nextCheckIn!,
      validatedData.check_in_days,
    )

    const warning = undefined

    const responseBody: any = {
      secretId: data.secret.id,
      ...data.secret,
      recipients: data.recipients.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        nostrPubkey: r.nostrPubkey,
      })),
      ...(warning ? { warning } : {}),
    }

    return new Response(JSON.stringify(responseBody), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        Location: `/api/secrets/${data.secret.id}`,
      },
    })
  } catch (error) {
    // Check if this is a database column error
    if (error instanceof Error && error.message.includes("recipient_name")) {
      console.error("Column mapping error detected:", error.message)
      if (insertData) {
        console.error("Insert data was:", JSON.stringify(insertData, null, 2))
      }
      throw APIError.database("Database schema mismatch", error)
    }

    const errorResponse = handleAPIError(error)
    return errorResponse
  }
}
