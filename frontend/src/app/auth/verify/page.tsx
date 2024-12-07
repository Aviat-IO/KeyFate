"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if we have a token in the URL
    const token = searchParams.get("token")
    if (token) {
      // If we have a token, we're in the verification process
      // The middleware will handle the actual verification
      return
    }
  }, [router, searchParams])

  return (
    <div>
      <h2 className="text-center text-3xl font-bold tracking-tight">
        Check your email
      </h2>
      <p className="text-muted-foreground mt-2 text-center text-sm">
        We've sent you a verification link. Please check your email to verify
        your account.
      </p>
    </div>
  )
}
