const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL as string;
if (!NEXT_PUBLIC_SITE_URL) {
  throw new Error("NEXT_PUBLIC_SITE_URL is not set");
}

// NextAuth environment variables (checked in auth config)
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET as string;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET as string;

const NEXT_PUBLIC_SUPPORT_EMAIL = process.env
  .NEXT_PUBLIC_SUPPORT_EMAIL as string;
if (!NEXT_PUBLIC_SUPPORT_EMAIL) {
  throw new Error("NEXT_PUBLIC_SUPPORT_EMAIL is not set");
}

const NEXT_PUBLIC_COMPANY = process.env.NEXT_PUBLIC_COMPANY as string;
if (!NEXT_PUBLIC_COMPANY) {
  throw new Error("NEXT_PUBLIC_COMPANY is not set");
}

const NEXT_PUBLIC_PARENT_COMPANY = process.env
  .NEXT_PUBLIC_PARENT_COMPANY as string;
if (!NEXT_PUBLIC_PARENT_COMPANY) {
  throw new Error("NEXT_PUBLIC_PARENT_COMPANY is not set");
}

// Optional - only required when using Stripe frontend components
const NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env
  .NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  NEXT_PUBLIC_COMPANY,
  NEXT_PUBLIC_PARENT_COMPANY,
  NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXTAUTH_SECRET,
};
