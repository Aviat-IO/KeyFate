import { NextResponse } from "next/server";

/**
 * Public configuration endpoint
 * Returns non-sensitive environment variables to the client
 * These values are loaded from runtime environment variables
 */
export async function GET() {
  // Only return public, non-sensitive configuration
  const publicConfig = {
    company: process.env.NEXT_PUBLIC_COMPANY || "KeyFate",
    env: process.env.NEXT_PUBLIC_ENV || "production",
    parentCompany: process.env.NEXT_PUBLIC_PARENT_COMPANY || "Aviat, LLC",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://keyfate.com",
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@keyfate.com",
    authProvider: process.env.NEXT_PUBLIC_AUTH_PROVIDER || "google",
    databaseProvider: process.env.NEXT_PUBLIC_DATABASE_PROVIDER || "cloudsql",
    btcPayServerUrl: process.env.NEXT_PUBLIC_BTCPAY_SERVER_URL || "",
  };

  return NextResponse.json(publicConfig);
}
