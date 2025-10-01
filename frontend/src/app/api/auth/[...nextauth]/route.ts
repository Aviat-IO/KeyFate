// @ts-nocheck - NextAuth v4 compatibility with App Router
import { authConfig } from "@/lib/auth-config";
import { getBaseUrl } from "@/lib/auth-config-production";
import NextAuth from "next-auth";

// Prevent static analysis during build
export const dynamic = "force-dynamic";

// Normalize NEXTAUTH_URL at runtime to avoid 0.0.0.0 issues
if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("0.0.0.0")) {
  const url = process.env.NEXT_PUBLIC_SITE_URL || getBaseUrl();
  process.env.NEXTAUTH_URL = url;
  process.env.NEXTAUTH_URL_INTERNAL = url;
}

// Create NextAuth handler
const handler = NextAuth(authConfig);

// Export handlers that fix any 0.0.0.0 URLs in Location headers
export async function GET(request: Request, context: any) {
  const response = await handler(request, context);
  return fixLocationHeader(response);
}

export async function POST(request: Request, context: any) {
  const response = await handler(request, context);
  return fixLocationHeader(response);
}

export async function HEAD(request: Request, context: any) {
  const response = await handler(request, context);
  return fixLocationHeader(response);
}

function fixLocationHeader(response: Response): Response {
  const location = response.headers.get("Location");
  if (location?.includes("0.0.0.0")) {
    const fixed = location.replace(
      /https?:\/\/0\.0\.0\.0(:\d+)?/,
      getBaseUrl(),
    );
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Location", fixed);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
  return response;
}
