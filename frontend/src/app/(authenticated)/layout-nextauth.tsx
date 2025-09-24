import { NavBar } from "@/components/nav-bar"
import { authConfig } from "@/lib/auth-config"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { ReactNode } from "react"

export async function getSessionSafe(): Promise<Session | null> {
  // next-auth v4 getServerSession accepts (req,res,options) or (options) typed as NextAuthOptions.
  // Our authConfig matches NextAuthOptions shape.
  // Cast to any to satisfy type mismatch between our rich callbacks and narrowed type in helper.
  return (await getServerSession(authConfig as any)) as Session | null
}

interface AuthenticatedLayoutProps {
  children: ReactNode
}

export default async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  try {
    // Use NextAuth server session instead of Supabase
    const session = (await getServerSession(
      authConfig as any,
    )) as Session | null

    if (!session?.user) {
      redirect("/sign-in")
    }

    return (
      <>
        <NavBar />
        <main>{children}</main>
      </>
    )
  } catch (error) {
    console.error("[AuthenticatedLayout] Session error:", error)
    redirect("/sign-in")
  }
}
