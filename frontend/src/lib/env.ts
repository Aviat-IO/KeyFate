// Helper function to check if we're in build mode
const isBuildTime = process.env.NODE_ENV === undefined || process.env.NEXT_PHASE === 'phase-production-build';

// Function to safely get environment variable with build-time fallback
function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];

  if (!value && required && !isBuildTime) {
    throw new Error(`${name} is not set`);
  }

  // Return empty string during build time to prevent errors
  return value || (isBuildTime ? '' : '');
}

const NEXT_PUBLIC_SITE_URL = getEnvVar('NEXT_PUBLIC_SITE_URL');

// NextAuth environment variables (checked in auth config)
const NEXTAUTH_SECRET = getEnvVar('NEXTAUTH_SECRET', false);
const GOOGLE_CLIENT_ID = getEnvVar('GOOGLE_CLIENT_ID', false);
const GOOGLE_CLIENT_SECRET = getEnvVar('GOOGLE_CLIENT_SECRET', false);

const NEXT_PUBLIC_SUPPORT_EMAIL = getEnvVar('NEXT_PUBLIC_SUPPORT_EMAIL');
const NEXT_PUBLIC_COMPANY = getEnvVar('NEXT_PUBLIC_COMPANY');
const NEXT_PUBLIC_PARENT_COMPANY = getEnvVar('NEXT_PUBLIC_PARENT_COMPANY');

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
