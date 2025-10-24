"use client"

import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

export default function SignInPage() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const callbackUrl = searchParams.get("callbackUrl")
    const next = searchParams.get("next")
    const error = searchParams.get("error")

    let redirectUrl = "/auth/signin"
    const params = new URLSearchParams()

    if (callbackUrl) params.set("callbackUrl", callbackUrl)
    if (next) params.set("next", next)
    if (error) params.set("error", error)

    if (params.toString()) {
      redirectUrl += `?${params.toString()}`
    }

    window.location.href = redirectUrl
  }, [searchParams])

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="text-muted-foreground mb-4 text-lg">
          Redirecting to sign in...
        </div>
        <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    </div>
  )
}
