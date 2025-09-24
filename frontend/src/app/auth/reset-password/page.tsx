"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

// Legacy route - redirect to sign-in page
export default function ResetPasswordPage() {
  const router = useRouter()

  useEffect(() => {
    // This feature is deprecated - redirect to sign-in
    router.replace("/sign-in?message=Please contact support for password reset assistance.")
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Redirecting...
        </h2>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          Password reset feature has been updated. Redirecting to sign-in page.
        </p>
      </div>
    </div>
  )
}
