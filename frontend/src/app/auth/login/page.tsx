"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"

// Legacy route - redirect to new sign-in page
export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next")

  useEffect(() => {
    // Redirect to the new sign-in page with same parameters
    const redirectPath = nextUrl
      ? `/sign-in?callbackUrl=${encodeURIComponent(nextUrl)}`
      : "/sign-in"

    router.replace(redirectPath)
  }, [router, nextUrl])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div>Redirecting to sign in...</div>
    </div>
  )
}
