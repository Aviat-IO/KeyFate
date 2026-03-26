import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async () => {
  const publicConfig = {
    company: process.env.PUBLIC_COMPANY || "KeyFate",
    env: process.env.PUBLIC_ENV || "production",
    parentCompany: process.env.PUBLIC_PARENT_COMPANY || "Aviat, LLC",
    siteUrl: process.env.PUBLIC_SITE_URL || "https://keyfate.com",
    stripePublishableKey: process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    supportEmail: process.env.PUBLIC_SUPPORT_EMAIL || "support@keyfate.com",
    authProvider: process.env.PUBLIC_AUTH_PROVIDER || "google",
    btcPayServerUrl: process.env.PUBLIC_BTCPAY_SERVER_URL || "",
  }

  return json(publicConfig)
}
