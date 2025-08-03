"use client"

import { AuthForm } from "@/components/auth-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

const supabase = createClient()

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next")

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        // Redirect to next URL if provided, otherwise to dashboard
        const redirectUrl = nextUrl || "/dashboard"
        router.push(redirectUrl)
        router.refresh()
      }
    } catch (error) {
      console.error(error)
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthForm
      title="Sign In"
      description="Welcome back! Sign in to your account"
      leftLink={{ href: "/auth/reset-password", text: "Forgot password?" }}
      rightLink={{
        text: "No account?",
        linkText: "Sign up",
        href: nextUrl ? `/auth/signup?next=${encodeURIComponent(nextUrl)}` : "/auth/signup",
      }}
    >
      <form onSubmit={handleEmailLogin} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </AuthForm>
  )
}
