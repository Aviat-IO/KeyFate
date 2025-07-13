"use client"

import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import { NEXT_PUBLIC_COMPANY } from "@/lib/env"
import { User } from "@supabase/supabase-js"

const supabase = createClient()

export function NavBar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <nav className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href={user ? "/dashboard" : "/"} className="text-xl font-bold">
            {NEXT_PUBLIC_COMPANY}
          </Link>

          <div className="flex items-center space-x-4">
            {!user && (
              <Button variant="ghost" asChild>
                <Link href="/pricing">Pricing</Link>
              </Button>
            )}
            <ThemeToggle />

            {loading ? (
              // Show nothing while loading to avoid flash
              <div className="h-9 w-20" />
            ) : user ? (
              // User is logged in - show sign out
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            ) : (
              // User is not logged in - show log in and sign up
              <>
                <Button variant="ghost" asChild>
                  <Link href="/auth/login">Log In</Link>
                </Button>
                <Button asChild>
                  <Link href="/auth/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
