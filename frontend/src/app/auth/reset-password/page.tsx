"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthForm } from "@/components/auth-form"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })
      if (error) throw error
      setMessage("Check your email for the password reset link")
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setMessage(null)
    }
  }

  return (
    <AuthForm
      title="Reset your password"
      description="Enter your email to receive a password reset link"
      leftLink={{ href: "/auth/login", text: "Back to sign in" }}
      rightLink={{
        text: "No account?",
        linkText: "Sign up",
        href: "/auth/signup",
      }}
    >
      {message && (
        <Alert className="border-primary/50 text-primary">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleReset} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthForm>
  )
}
