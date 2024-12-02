"use client"

import { Button } from "@/components/ui/button"
import { RiGoogleFill } from "@remixicon/react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"
import { Provider } from "@supabase/supabase-js"

export function SocialButtons() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleOAuthSignIn = async (provider: Provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "email profile",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      })

      if (error) {
        console.error(`[OAuth] ${provider} sign in error:`, error)
        throw error
      }
    } catch (error) {
      console.error(`[OAuth] ${provider} sign in error:`, error)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={() => handleOAuthSignIn("google")}
        type="button"
      >
        <RiGoogleFill
          className="mr-3 text-[#DB4437] dark:text-white/60"
          size={16}
          aria-hidden="true"
        />
        Continue with Google
      </Button>
    </div>
  )
}
