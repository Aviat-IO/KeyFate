// @ts-nocheck - NextAuth v4 compatibility with App Router
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth-config";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

// Create NextAuth handler for Next.js App Router
const handler = NextAuth(authConfig);

export { handler as GET, handler as POST };
