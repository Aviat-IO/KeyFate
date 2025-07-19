"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { completeAuthFlow } from "@/lib/auth"
import { createClient } from "@/utils/supabase/client"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [sessionEstablished, setSessionEstablished] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const establishSession = async () => {
      // Check if we have a recovery token in the URL
      const hash = window.location.hash
      if (!hash || !hash.includes("access_token=")) {
        setError("Invalid password reset link")
        return
      }

      try {
        const result = await completeAuthFlow(hash)

        if (result.success) {
          setSessionEstablished(true)
        } else {
          setError(result.error || "Invalid password reset link")
        }
      } catch (error) {
        console.error("[UpdatePassword] Exception during auth flow:", error)
        setError("Invalid password reset link")
      }
    }

    establishSession()
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) throw updateError

      setMessage("Password updated successfully")
      // Wait a moment to show the success message
      setTimeout(() => {
        router.push("/auth/login")
      }, 2000)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to update password",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div>
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Update your password
        </h2>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          {sessionEstablished
            ? "Enter your new password below"
            : "Verifying your reset link..."}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {sessionEstablished && (
        <form className="mt-8 space-y-6" onSubmit={handleUpdatePassword}>
          {message && (
            <Alert className="border-primary/50 text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="sr-only">
                New password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                required
                minLength={6}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                Confirm new password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfirmPassword(e.target.value)
                }
                required
                minLength={6}
              />
            </div>
          </div>
          <div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating password..." : "Update password"}
            </Button>
          </div>
        </form>
      )}
    </>
  )
}
