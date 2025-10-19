import { SecretCard } from "@/components/secret-card"
import { SecretsGrid } from "@/components/secrets-grid"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { UpgradeSuccessDialog } from "@/components/subscription/UpgradeSuccessDialog"
import {
  DashboardService,
  DashboardTimeoutError,
} from "@/lib/dashboard/dashboard-service"
import { getUserTierInfo } from "@/lib/subscription"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

// Force Node.js runtime for database operations
export const runtime = "nodejs"

async function SecretsLoader() {
  console.log("[Dashboard] SecretsLoader starting with timeout protection...")

  try {
    // Use the new dashboard service with timeout protection
    const result = await DashboardService.loadDashboardData()

    console.log(
      "[Dashboard] Dashboard service result:",
      result.success ? "SUCCESS" : "FAILED",
    )

    if (!result.success) {
      if (result.error === "NO_SESSION") {
        console.log("[Dashboard] No session found, redirecting to sign-in")
        redirect("/sign-in")
      }

      // CRITICAL FIX: Throw errors instead of returning JSX to prevent Suspense hanging
      if (result.error === "TIMEOUT") {
        console.error("[Dashboard] Operation timed out:", result.message)
        // Throw error to be caught by error boundary instead of returning JSX
        throw new Error(`DASHBOARD_TIMEOUT: ${result.message}`)
      }

      // Other errors - also throw instead of returning JSX
      console.error("[Dashboard] Dashboard service error:", result.message)
      throw new Error(
        `DASHBOARD_ERROR: ${result.message || "Unknown error loading dashboard"}`,
      )
    }

    // Success case
    const { user, secrets } = result.data
    console.log("[Dashboard] User authenticated:", user.id)
    console.log(
      "[Dashboard] Secrets loaded:",
      secrets?.length || 0,
      "secrets found",
    )

    const tierInfo = await getUserTierInfo(user.id)
    const canCreateSecret = tierInfo?.limits.secrets.canCreate ?? false

    if (!secrets || secrets.length === 0) {
      console.log("[Dashboard] No secrets found, showing empty state")
      return (
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>No Secrets Yet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                You haven't created any secrets yet. Get started by creating
                your first dead man's switch.
              </p>
              <Button asChild>
                <Link href="/secrets/new">Create Your First Secret</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    console.log(
      "[Dashboard] Rendering secrets grid with",
      secrets.length,
      "secrets",
    )

    return <SecretsGrid secrets={secrets} />
  } catch (error) {
    console.error("[Dashboard] Unexpected error in SecretsLoader:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    // Handle specific dashboard errors that we threw
    if (errorMessage.startsWith("DASHBOARD_TIMEOUT:")) {
      return (
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Loading Timeout</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                The dashboard is taking longer than expected to load. This might
                be due to a database connection issue.
              </p>
              <div className="space-y-2">
                <Button asChild>
                  <Link href="/dashboard">Try Again</Link>
                </Button>
                <p className="text-muted-foreground text-sm">
                  If this problem persists, please contact support.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    if (errorMessage.startsWith("DASHBOARD_ERROR:")) {
      const userMessage = errorMessage.replace("DASHBOARD_ERROR: ", "")
      return (
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Error Loading Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {userMessage ||
                  "There was an error loading your dashboard. Please try refreshing the page."}
              </p>
              <Button asChild>
                <Link href="/dashboard">Refresh</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    // Handle legacy timeout errors from the service
    if (error instanceof DashboardTimeoutError) {
      return (
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Timeout</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                The dashboard timed out while loading. This usually indicates a
                database connection issue.
              </p>
              <Button asChild>
                <Link href="/dashboard">Try Again</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    // Generic error handling for unexpected errors
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              An unexpected error occurred while loading your dashboard. Please
              try refreshing the page.
            </p>
            <Button asChild>
              <Link href="/dashboard">Refresh</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}

function LoadingSkeleton() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <LoadingIndicator text="Loading your secrets..." size="md" />
    </div>
  )
}

async function DashboardHeader() {
  const result = await DashboardService.loadDashboardData()

  if (!result.success || !result.data) {
    return (
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your Secrets</h1>
        <Button asChild variant="outline">
          <Link href="/secrets/new">Create New Secret</Link>
        </Button>
      </div>
    )
  }

  const { user } = result.data
  const tierInfo = await getUserTierInfo(user.id)
  const canCreateSecret = tierInfo?.limits.secrets.canCreate ?? false

  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-3xl font-bold">Your Secrets</h1>
      <Button asChild variant="outline">
        <Link href="/secrets/new">Create New Secret</Link>
      </Button>
    </div>
  )
}

export default async function DashboardPage() {
  return (
    <div className="mx-auto py-8 sm:px-4">
      <UpgradeSuccessDialog />

      <Suspense
        fallback={
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Your Secrets</h1>
            <Button variant="outline" disabled>
              Loading...
            </Button>
          </div>
        }
      >
        <DashboardHeader />
      </Suspense>

      <Suspense fallback={<LoadingSkeleton />}>
        <SecretsLoader />
      </Suspense>
    </div>
  )
}
