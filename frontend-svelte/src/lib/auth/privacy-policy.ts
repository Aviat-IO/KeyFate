import { getDatabase } from "$lib/db/drizzle"
import { privacyPolicyAcceptance, policyDocuments } from "$lib/db/schema"
import { eq, and, desc } from "drizzle-orm"

export const CURRENT_PRIVACY_POLICY_VERSION = "1.0.0"

/**
 * Get the current active policy document
 * @param type - The policy document type
 */
export async function getCurrentPolicyDocument(
  type: "privacy_policy" | "terms_of_service",
) {
  const db = await getDatabase()

  const docs = await db
    .select()
    .from(policyDocuments)
    .where(eq(policyDocuments.type, type))
    .orderBy(desc(policyDocuments.effectiveDate))
    .limit(1)

  return docs[0] || null
}

/**
 * Record privacy policy acceptance for a user
 * Links to the exact policy documents that were accepted
 * @param userId - The user ID
 * @param ipAddress - The IP address (optional)
 * @param version - The policy version (defaults to current)
 */
export async function recordPrivacyPolicyAcceptance(
  userId: string,
  ipAddress?: string,
  version: string = CURRENT_PRIVACY_POLICY_VERSION,
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDatabase()

    // Get the current policy documents
    const [privacyDoc, termsDoc] = await Promise.all([
      getCurrentPolicyDocument("privacy_policy"),
      getCurrentPolicyDocument("terms_of_service"),
    ])

    if (!privacyDoc || !termsDoc) {
      console.error("Policy documents not found in database")
      return {
        success: false,
        error: "Policy documents not found",
      }
    }

    await db.insert(privacyPolicyAcceptance).values({
      userId,
      policyVersion: version,
      policyDocumentId: privacyDoc.id,
      termsDocumentId: termsDoc.id,
      ...(ipAddress && { ipAddress }),
    } as any)

    return { success: true }
  } catch (error) {
    console.error("Error recording privacy policy acceptance:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check if a user has accepted the current privacy policy
 * @param userId - The user ID
 * @param requiredVersion - The required policy version (defaults to current)
 */
export async function hasAcceptedPrivacyPolicy(
  userId: string,
  requiredVersion: string = CURRENT_PRIVACY_POLICY_VERSION,
): Promise<boolean> {
  try {
    const db = await getDatabase()

    const acceptances = await db
      .select()
      .from(privacyPolicyAcceptance)
      .where(eq(privacyPolicyAcceptance.userId, userId))
      .orderBy(privacyPolicyAcceptance.acceptedAt)

    // Check if any acceptance matches the required version
    return acceptances.some((acc) => acc.policyVersion === requiredVersion)
  } catch (error) {
    console.error("Error checking privacy policy acceptance:", error)
    return false
  }
}

/**
 * Get the IP address from a request
 * @param headers - The request headers
 */
export function getIpAddress(headers: Headers): string | undefined {
  // Try various headers in order of preference
  const forwardedFor = headers.get("x-forwarded-for")
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim()
  }

  const realIp = headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }

  // Fallback headers
  const cfConnectingIp = headers.get("cf-connecting-ip") // Cloudflare
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  return undefined
}
