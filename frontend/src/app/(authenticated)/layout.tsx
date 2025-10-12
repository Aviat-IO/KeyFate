import { NavBar } from "@/components/nav-bar"
import {
  DashboardService,
  DashboardTimeoutError,
} from "@/lib/dashboard/dashboard-service"
import { redirect } from "next/navigation"
import { ReactNode } from "react"

interface AuthenticatedLayoutProps {
  children: ReactNode
}

export default async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  console.log(
    "[AuthenticatedLayout] Starting layout check with timeout protection...",
  )

  try {
    // Use the dashboard service for session management with timeout protection
    const session = await DashboardService.getSession()
    console.log(
      "[AuthenticatedLayout] Session result:",
      session ? "FOUND" : "NOT FOUND",
    )

    if (session?.user) {
      console.log("[AuthenticatedLayout] User details:", {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      })
    }

    if (!session?.user) {
      console.log(
        "[AuthenticatedLayout] No user in session, redirecting to sign-in",
      )
      redirect("/sign-in")
    }

    console.log("[AuthenticatedLayout] User authenticated, rendering layout")
    return (
      <>
        <NavBar />
        <main>{children}</main>
      </>
    )
  } catch (error) {
    console.error("[AuthenticatedLayout] Session error:", error)

    // Handle timeout errors specifically
    if (error instanceof DashboardTimeoutError) {
      console.error(
        "[AuthenticatedLayout] Session timeout detected, redirecting to sign-in",
      )
    }

    redirect("/sign-in")
  }
}
