"use client"

import { EmailVerificationPrompt } from "@/components/auth/email-verification"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
type MinimalUser = {
  id?: string
  email?: string
  app_metadata?: { provider?: string }
  email_verified?: boolean
}

interface EmailVerificationFlowProps {
  user: MinimalUser
  nextUrl?: string
}

interface SupabaseUser extends MinimalUser {
  email_verified?: boolean
}

export function EmailVerificationFlow({
  user,
  nextUrl = "/dashboard",
}: EmailVerificationFlowProps) {
  const router = useRouter()
  const [showPrompt, setShowPrompt] = useState(true)

  const supabaseUser = user as SupabaseUser
  const provider = user.app_metadata?.provider

  useEffect(() => {
    // Auto-skip verification for OAuth users or already verified users
    if (
      supabaseUser.email_verified ||
      provider === "google" ||
      provider === "github" ||
      provider === "apple"
    ) {
      setShowPrompt(false)
      // Short delay to show the success message before redirecting
      const timer = setTimeout(() => {
        router.push(nextUrl)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [supabaseUser.email_verified, provider, nextUrl, router])

  const handleVerificationComplete = () => {
    router.push(nextUrl)
  }

  const handleCancel = () => {
    router.push("/auth/login")
  }

  // Show success message for OAuth or already verified users
  if (!showPrompt) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <Card className="mx-auto w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <CheckCircle2 className="text-accent-foreground mx-auto h-16 w-16" />
              <div>
                <h3 className="text-accent-foreground text-lg font-semibold">
                  Welcome!
                </h3>
                <p className="text-muted-foreground text-sm">
                  {provider === "google" ||
                  provider === "github" ||
                  provider === "apple"
                    ? `Your ${provider} account is already verified.`
                    : "Your email is already verified."}{" "}
                  Redirecting...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show verification prompt for email/password users
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <EmailVerificationPrompt
        email={user.email || ""}
        onVerificationComplete={handleVerificationComplete}
        onCancel={handleCancel}
      />
    </div>
  )
}
