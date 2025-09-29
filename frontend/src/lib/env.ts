/**
 * Server-side environment variables
 * This file should only be imported in server components or API routes
 * For client-side config, use the ConfigContext instead
 */

// Helper function to check if we're running on the server
const isServer = typeof window === 'undefined';

// Helper function to check if we're in build mode
const isBuildTime = process.env.NODE_ENV === undefined || process.env.NEXT_PHASE === 'phase-production-build';

// Function to safely get environment variable (server-side only)
function getEnvVar(name: string, required: boolean = true): string {
  // Prevent usage on client side
  if (!isServer && !isBuildTime) {
    console.warn(`Attempted to access ${name} on client side. Use ConfigContext instead.`);
    return '';
  }

  const value = process.env[name];

  if (!value && required && !isBuildTime) {
    // Only throw on server side when variable is missing
    if (isServer) {
      throw new Error(`${name} is not set`);
    }
    return '';
  }

  // Return empty string during build time to prevent errors
  return value || '';
}

// Server-side environment variables
const NEXT_PUBLIC_SITE_URL = getEnvVar('NEXT_PUBLIC_SITE_URL', false);
const NEXTAUTH_SECRET = getEnvVar('NEXTAUTH_SECRET', false);
const GOOGLE_CLIENT_ID = getEnvVar('GOOGLE_CLIENT_ID', false);
const GOOGLE_CLIENT_SECRET = getEnvVar('GOOGLE_CLIENT_SECRET', false);
const NEXT_PUBLIC_SUPPORT_EMAIL = getEnvVar('NEXT_PUBLIC_SUPPORT_EMAIL', false);
const NEXT_PUBLIC_COMPANY = getEnvVar('NEXT_PUBLIC_COMPANY', false);
const NEXT_PUBLIC_PARENT_COMPANY = getEnvVar('NEXT_PUBLIC_PARENT_COMPANY', false);
const NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = getEnvVar('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', false);

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
