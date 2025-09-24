"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") {
      return // Still loading session
    }

    if (session?.user) {
      // User is authenticated, redirect to dashboard
      router.push("/dashboard")
    } else {
      // User is not authenticated, show auth pages
      setLoading(false)
    }
  }, [session, status, router])

  if (loading || status === "loading") {
    return <div>Loading...</div>
  }

  return <>{children}</>
}
