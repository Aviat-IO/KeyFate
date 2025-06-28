"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const type = searchParams.get("type")
  const next = searchParams.get("next")

  useEffect(() => {
    async function handleEmailVerification() {
      if (token && type === "email_change") {
        const supabase = createClientComponentClient()
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "email_change",
        })

        if (!error) {
          router.push("/dashboard")
        }
      }
    }

    async function handleVerificationToken() {
      if (token && type === "signup") {
        const supabase = createClientComponentClient()

        // First verify the token
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "signup",
        })

        if (verifyError) {
          console.error("Error verifying token:", verifyError)
          return
        }

        // Then get the session - user should be logged in after verification
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          // Redirect to dashboard or the next URL if provided
          router.push(next || "/dashboard")
        }
      }
    }

    handleEmailVerification()
    handleVerificationToken()
  }, [token, type, router, next])

  // Your existing sign in form JSX here...
  return null
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  )
}
