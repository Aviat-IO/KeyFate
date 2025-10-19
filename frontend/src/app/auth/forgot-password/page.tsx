"use client"

import { AuthForm } from "@/components/auth-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
        setEmail("")
      } else {
        setError(data.error || "Failed to send reset email")
      }
    } catch (error) {
      console.error("Password reset request error:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthForm
      title="Reset your password"
      description="Enter your email address and we'll send you a link to reset your password."
      leftLink={{ href: "/sign-in", text: "Back to sign in" }}
      hideSocialButtons={true}
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-accent bg-accent text-accent-foreground">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            If an account exists with that email, we've sent password reset
            instructions. Please check your inbox.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-4 text-center text-sm">
        Remember your password?{" "}
        <Link
          href="/sign-in"
          className="text-primary hover:text-primary/90 transition hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthForm>
  )
}
