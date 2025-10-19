"use client"

import { AuthForm } from "@/components/auth-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token")
    }
  }, [token])

  const validatePasswordClient = (pwd: string): string[] => {
    const errors: string[] = []

    if (pwd.length < 10) {
      errors.push("At least 10 characters long")
    }
    if (!/(?=.*[a-z])/.test(pwd)) {
      errors.push("One lowercase letter")
    }
    if (!/(?=.*[A-Z])/.test(pwd)) {
      errors.push("One uppercase letter")
    }
    if (!/(?=.*\d)/.test(pwd)) {
      errors.push("One number")
    }
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(pwd)) {
      errors.push("One special character (!@#$%^&*)")
    }

    return errors
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (value) {
      const errors = validatePasswordClient(value)
      setValidationErrors(errors)
    } else {
      setValidationErrors([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    const clientErrors = validatePasswordClient(password)
    if (clientErrors.length > 0) {
      setError("Password does not meet requirements")
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push("/sign-in")
        }, 3000)
      } else {
        setError(data.error || "Failed to reset password")
      }
    } catch (error) {
      console.error("Password reset error:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthForm
        title="Reset your password"
        description="Invalid password reset link"
        leftLink={{ href: "/sign-in", text: "Back to sign in" }}
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This password reset link is invalid or has expired. Please request a
            new one.
          </AlertDescription>
        </Alert>
        <div className="text-center">
          <Link
            href="/auth/forgot-password"
            className="text-primary hover:text-primary/90 transition hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </AuthForm>
    )
  }

  return (
    <AuthForm
      title="Reset your password"
      description="Enter your new password below."
      leftLink={{ href: "/sign-in", text: "Back to sign in" }}
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
            Password reset successfully! Redirecting to sign in...
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            disabled={loading || success}
          />
          {password && validationErrors.length > 0 && (
            <div className="text-muted-foreground text-sm">
              <p className="font-medium">Password must include:</p>
              <ul className="list-inside list-disc space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx} className="text-destructive">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {password && validationErrors.length === 0 && (
            <p className="text-accent-foreground text-sm">
              ✓ Password meets all requirements
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading || success}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || success || validationErrors.length > 0}
        >
          {loading ? "Resetting..." : "Reset password"}
        </Button>
      </form>
    </AuthForm>
  )
}
