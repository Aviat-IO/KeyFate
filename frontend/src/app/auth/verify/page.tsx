"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Legacy route - redirect to new verify-email page
    const token = searchParams.get("token")
    const type = searchParams.get("type")

    let redirectPath = "/auth/verify-email"

    const params = new URLSearchParams()
    if (token) params.set("token", token)
    if (type) params.set("type", type)

    if (params.toString()) {
      redirectPath += `?${params.toString()}`
    }

    router.replace(redirectPath)
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Redirecting to email verification...
        </h2>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          Please wait while we redirect you to the new verification page.
        </p>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyContent />
    </Suspense>
  )
}
