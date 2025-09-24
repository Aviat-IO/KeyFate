"use client"

import { Button } from "@/components/ui/button"
import { googleOAuthFlow } from "@/lib/auth/oauth-service"
import { useEffect, useState } from "react"

interface ProviderStatus {
  google: boolean
  email: boolean
}

export function SocialButtons() {
  const [loading, setLoading] = useState(false)
  const [providers, setProviders] = useState<ProviderStatus>({ google: false, email: false })
  const [providersLoaded, setProvidersLoaded] = useState(false)

  useEffect(() => {
    const checkProviders = async () => {
      try {
        const response = await fetch('/api/auth/providers')
        const data = await response.json()
        setProviders(data)
      } catch (error) {
        console.error('Failed to check provider status:', error)
      } finally {
        setProvidersLoaded(true)
      }
    }

    checkProviders()
  }, [])

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const result = await googleOAuthFlow({ redirectTo: "/dashboard" })

      if (!result.success) {
        console.error("Error signing in with Google:", result.error)
        // You can add toast notification here for user feedback
      }
    } catch (error) {
      console.error("Error during Google OAuth:", error)
    } finally {
      setLoading(false)
    }
  }

  // Don't render anything if no social providers are available or still loading
  if (!providersLoaded || !providers.google) {
    return null
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
