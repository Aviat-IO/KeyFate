"use client"

import { createClient } from "@/utils/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleVerification = async () => {
      const token = searchParams.get("token")
      const type = searchParams.get("type")

      console.log("[Verify] Token:", token)
      console.log("[Verify] Type:", type)

      // Check if we have tokens in the URL fragment (from Supabase redirect)
      const hash = window.location.hash
      if (hash && hash.includes("access_token")) {
        console.log("[Verify] Found tokens in URL fragment")
        const supabase = createClient()

        try {
          // Parse the fragment to get the tokens
          const params = new URLSearchParams(hash.substring(1))
          const accessToken = params.get("access_token")
          const refreshToken = params.get("refresh_token")

          if (accessToken && refreshToken) {
            // Set the session with the tokens
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (error) {
              console.error("[Verify] Error setting session:", error)
              router.push(
                "/auth/login?error=Email verification failed. Please try again.",
              )
              return
            }

            console.log("[Verify] Session set successfully:", data)
            // Clear the hash from the URL
            window.history.replaceState(null, "", window.location.pathname)
            // Redirect to dashboard
            router.push("/dashboard")
            return
          }
        } catch (error) {
          console.error("[Verify] Exception setting session:", error)
          router.push(
            "/auth/login?error=Email verification failed. Please try again.",
          )
          return
        }
      }

      // Handle direct token verification (if Supabase config is updated)
      if (token && type === "signup") {
        const supabase = createClient()

        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: "signup",
          })

          if (error) {
            console.error("[Verify] Error:", error)
            router.push(
              "/auth/login?error=Email verification failed. Please try again.",
            )
            return
          }

          console.log("[Verify] Success:", data)
          // Redirect to dashboard on successful verification
          router.push("/dashboard")
        } catch (error) {
          console.error("[Verify] Exception:", error)
          router.push(
            "/auth/login?error=Email verification failed. Please try again.",
          )
        }
      }
    }

    handleVerification()
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Verifying your email...
        </h2>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          Please wait while we verify your email address.
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
