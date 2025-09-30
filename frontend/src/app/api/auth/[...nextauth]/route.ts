// @ts-nocheck - NextAuth v4 compatibility with App Router
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth-config";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

// Ensure NEXTAUTH_URL is properly set for OAuth redirects
if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("0.0.0.0")) {
  // Force NextAuth to use the correct URL for OAuth
  process.env.NEXTAUTH_URL_INTERNAL = process.env.NEXTAUTH_URL;
}

// Create NextAuth handler for Next.js App Router
const handler = NextAuth(authConfig);

export { handler as GET, handler as POST };
