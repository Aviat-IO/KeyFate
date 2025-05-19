"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { RiGoogleFill } from "@remixicon/react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Provider } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"
import { useState } from "react"

export function SocialButtons() {
  const supabase = createClientComponentClient()
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleOAuthSignIn = async (provider: Provider) => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "openid email profile",
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
      toast({
        title: "Authentication failed",
        description: "Could not sign in with Google. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={() => handleOAuthSignIn("google")}
        type="button"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            <RiGoogleFill
              className="mr-3 text-[#DB4437] dark:text-white/60"
              size={16}
              aria-hidden="true"
            />
            Continue with Google
          </>
        )}
      </Button>
    </div>
  )
}
