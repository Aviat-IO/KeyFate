"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { NEXT_PUBLIC_SITE_URL } from "@/lib/env"

const supabase = createClient()

export function SocialButtons() {
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${NEXT_PUBLIC_SITE_URL}/auth/callback`,
        },
      })

      if (error) {
        console.error("Error signing in with Google:", error)
      }
    } catch (error) {
      console.error("Error during Google OAuth:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={handleGoogleLogin}
        disabled={loading}
        variant="outline"
        className="w-full"
      >
        {loading ? "Signing in..." : "Continue with Google"}
      </Button>
    </div>
  )
}
