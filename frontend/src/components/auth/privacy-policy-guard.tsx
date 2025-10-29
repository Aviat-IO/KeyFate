"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import type { Session } from "next-auth"
import Link from "next/link"

export function PrivacyPolicyGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const [needsAcceptance, setNeedsAcceptance] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function checkAcceptance() {
      const userId = (session?.user as any)?.id
      if (status === "authenticated" && userId) {
        try {
          const response = await fetch("/api/auth/check-privacy-policy")
          const data = await response.json()

          if (!response.ok) {
            console.error("Failed to check privacy policy status")
            return
          }

          setNeedsAcceptance(!data.accepted)
        } catch (error) {
          console.error("Error checking privacy policy:", error)
        }
      }
    }

    checkAcceptance()
  }, [status, session])

  const handleAccept = async () => {
    setIsAccepting(true)
    setError("")

    try {
      const response = await fetch("/api/auth/accept-privacy-policy", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to record acceptance")
      }

      setNeedsAcceptance(false)
    } catch (error) {
      console.error("Error accepting privacy policy:", error)
      setError("Failed to record acceptance. Please try again.")
    } finally {
      setIsAccepting(false)
    }
  }

  if (needsAcceptance) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card border-border mx-4 max-w-lg rounded-xl border p-6 shadow-xl">
          <h2 className="text-foreground mb-4 text-2xl font-bold">
            Privacy Policy Update
          </h2>
          <p className="text-muted-foreground mb-4 text-sm">
            We've updated our Privacy Policy. Please review and accept the
            changes to continue using KeyFate.
          </p>

          <div className="mb-6 space-y-2">
            <Link
              href="/privacy-policy"
              target="_blank"
              className="text-primary block text-sm hover:underline"
            >
              Read Privacy Policy
            </Link>
            <Link
              href="/terms-of-service"
              target="_blank"
              className="text-primary block text-sm hover:underline"
            >
              Read Terms of Service
            </Link>
          </div>

          {error && (
            <div className="border-destructive bg-destructive/10 text-destructive mb-4 rounded border p-2 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={isAccepting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-2 font-medium disabled:opacity-50"
          >
            {isAccepting ? "Accepting..." : "I Accept"}
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
