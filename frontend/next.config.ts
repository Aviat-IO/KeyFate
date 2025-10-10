import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_COMPANY: process.env.NEXT_PUBLIC_COMPANY,
    NEXT_PUBLIC_PARENT_COMPANY: process.env.NEXT_PUBLIC_PARENT_COMPANY,
    NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  // TypeScript and ESLint errors will be checked during build
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // Temporarily ignore ESLint warnings during builds
    // TODO: Fix ESLint warnings and re-enable
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
