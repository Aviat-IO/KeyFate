"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SocialButtons } from "@/components/ui/social-buttons"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const error = searchParams.get("error")
    if (error) setError(error)

    const signout = searchParams.get("signout")
    console.log({ signout })

    const handleHashParams = async () => {
      // Check if we have hash parameters
      if (typeof window !== "undefined" && window.location.hash) {
        try {
          setLoading(true)
          // Parse the hash parameters
          const hashParams = new URLSearchParams(
            window.location.hash.substring(1),
          )
          const accessToken = hashParams.get("access_token")
          const refreshToken = hashParams.get("refresh_token")
          const type = hashParams.get("type")

          if (accessToken && type === "signup") {
            // Set the session using the tokens
            const {
              data: { session },
              error: sessionError,
            } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken!,
            })

            if (sessionError) {
              console.error("Error setting session:", sessionError)
              setError(sessionError.message)
              return
            }

            if (session) {
              // Clear the hash from the URL without triggering a reload
              window.history.replaceState(null, "", window.location.pathname)
              // Redirect to dashboard
              router.push("/dashboard")
              router.refresh()
            }
          }
        } catch (error) {
          console.error("Error handling hash params:", error)
          setError(
            error instanceof Error ? error.message : "Authentication failed",
          )
        } finally {
          setLoading(false)
        }
      }
    }

    const checkSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("[LoginPage] Session check error:", sessionError)
          return
        }

        if (session && !searchParams.get("signout")) {
          router.push("/dashboard")
          router.refresh()
        }
      } catch (error) {
        console.error("[LoginPage] Session check error:", error)
      }
    }

    handleHashParams()
    checkSession()
  }, [router, searchParams, supabase.auth])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (signInError) throw signInError

      if (!data?.session) {
        throw new Error("No session returned after login")
      }

      // Refresh the page to ensure middleware picks up the new session
      router.refresh()
      router.push("/dashboard")
    } catch (error) {
      console.error("[LoginPage] Login error:", error)
      setError(error instanceof Error ? error.message : "Failed to sign in")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div>
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Sign in to your account
        </h2>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          Or{" "}
          <Link
            href="/auth/signup"
            className="text-primary hover:text-primary/90 font-medium transition hover:underline"
          >
            create a new account
          </Link>
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleLogin}>
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </div>

        <div className="flex justify-center">
          <Link
            href="/auth/reset-password"
            className="text-primary hover:text-primary/90 text-sm transition hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">
            Or continue with
          </span>
        </div>
      </div>

      <SocialButtons />
    </>
  )
}
