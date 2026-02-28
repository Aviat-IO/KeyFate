import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"

/**
 * GET /api/config
 *
 * Public configuration endpoint.
 * Returns non-sensitive environment variables to the client.
 * These values are loaded from runtime environment variables.
 */
export const GET: RequestHandler = async () => {
  // Only return public, non-sensitive configuration
  const publicConfig = {
    company: process.env.PUBLIC_COMPANY || process.env.NEXT_PUBLIC_COMPANY || "KeyFate",
    env: process.env.PUBLIC_ENV || process.env.NEXT_PUBLIC_ENV || "production",
    parentCompany: process.env.PUBLIC_PARENT_COMPANY || process.env.NEXT_PUBLIC_PARENT_COMPANY || "Aviat, LLC",
    siteUrl: process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://keyfate.com",
    stripePublishableKey: process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    supportEmail: process.env.PUBLIC_SUPPORT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@keyfate.com",
    authProvider: process.env.PUBLIC_AUTH_PROVIDER || process.env.NEXT_PUBLIC_AUTH_PROVIDER || "google",
    databaseProvider: process.env.PUBLIC_DATABASE_PROVIDER || process.env.NEXT_PUBLIC_DATABASE_PROVIDER || "cloudsql",
    btcPayServerUrl: process.env.PUBLIC_BTCPAY_SERVER_URL || process.env.NEXT_PUBLIC_BTCPAY_SERVER_URL || "",
  }

  return json(publicConfig)
}
