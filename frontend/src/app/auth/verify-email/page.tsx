"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/utils/supabase/client"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const email = searchParams.get("email")

  const handleResendEmail = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Email address not found. Please try signing up again.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email,
      })

      if (resendError) {
        toast({
          title: "Error",
          description: resendError.message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Email sent",
          description:
            "Verification email has been resent. Please check your inbox.",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to resend verification email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md space-y-4 text-center">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Check your email
        </h2>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          We've sent you a verification link. Please check your email to verify
          your account.
        </p>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Didn't receive an email? Check your spam folder.
          </p>
          <Button
            onClick={handleResendEmail}
            disabled={loading}
            variant="link"
            className="text-xs"
          >
            {loading ? "Sending..." : "Click here to resend verification email"}
          </Button>
        </div>
      </div>
    </div>
  )
}
