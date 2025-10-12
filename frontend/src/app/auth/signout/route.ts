import { authConfig } from "@/lib/auth-config"
import { NEXT_PUBLIC_SITE_URL } from "@/lib/env"
import { getServerSession } from "next-auth/next"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  // With NextAuth JWT sessions, server-side signout typically clears on client. For API route, redirect to sign-in.
  const session = await getServerSession(authConfig as any)
  if (session) {
    // Best-effort: client should call next-auth signOut(); here we just redirect.
  }
  return NextResponse.redirect(new URL("/", NEXT_PUBLIC_SITE_URL))
}
