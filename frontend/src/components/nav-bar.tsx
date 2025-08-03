"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { NEXT_PUBLIC_COMPANY } from "@/lib/env"
import { createClient } from "@/utils/supabase/client"
import { User } from "@supabase/supabase-js"
import { Menu } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const supabase = createClient()

interface NavBarProps {
  user?: User | null
}

export function NavBar({ user: propUser }: NavBarProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(propUser ?? null)
  const [loading, setLoading] = useState(propUser === undefined)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isProUser, setIsProUser] = useState(false)
  const [checkingSubscription, setCheckingSubscription] = useState(false)

  useEffect(() => {
    // If user prop is provided, use it (for testing)
    if (propUser !== undefined) {
      setUser(propUser)
      setLoading(false)
      return
    }

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
  }, [propUser])

  // Check subscription status when user changes
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user) {
        setIsProUser(false)
        return
      }

      setCheckingSubscription(true)
      try {
        const { data: tier } = await supabase
          .from("user_tiers")
          .select(
            `
            tier_id,
            tiers!inner(name)
          `,
          )
          .eq("user_id", user.id)
          .maybeSingle()

        // If no tier exists, assume free tier
        setIsProUser(tier?.tiers?.name === "pro")
      } catch (error) {
        console.error("Error checking subscription status:", error)
        setIsProUser(false)
      } finally {
        setCheckingSubscription(false)
      }
    }

    checkSubscriptionStatus()
  }, [user])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setMobileMenuOpen(false) // Close mobile menu
    router.push("/auth/login")
    router.refresh()
  }

  const handleMobileMenuItemClick = () => {
    setMobileMenuOpen(false)
  }

  return (
    <nav className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <Link
              href={user ? "/dashboard" : "/"}
              className="text-xl font-bold"
            >
              {NEXT_PUBLIC_COMPANY}
            </Link>
            {/* Dashboard link when authenticated user is on home page */}
            {user && pathname === "/" && (
              <Button variant="ghost" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            )}
          </div>

          {/* Desktop Menu */}
          <div className="hidden items-center space-x-4 md:flex">
            {!user && (
              <Button variant="ghost" asChild>
                <Link href="/pricing">Pricing</Link>
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link href="/decrypt">Recover Secret</Link>
            </Button>
            <ThemeToggle />

            {loading ? (
              // Show nothing while loading to avoid flash
              <div className="h-9 w-20" />
            ) : user ? (
              // User is logged in - show upgrade button if not pro, and sign out
              <>
                {!checkingSubscription && !isProUser && (
                  <Button asChild>
                    <Link href="/pricing">Upgrade to Pro</Link>
                  </Button>
                )}
                <Button variant="outline" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </>
            ) : (
              // User is not logged in - show log in and sign up
              <>
                <Button variant="ghost" asChild>
                  <Link href="/auth/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/auth/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="flex items-center space-x-2 md:hidden">
            <ThemeToggle />

            {/* Show Sign Up button on mobile for unauthenticated users */}
            {!loading && !user && (
              <Button asChild size="sm">
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            )}

            <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  data-testid="mobile-menu-trigger"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-sm p-4">
                <DialogTitle className="sr-only">Navigation Menu</DialogTitle>
                <DialogDescription className="sr-only">
                  Mobile navigation menu with links and user options
                </DialogDescription>
                <div className="flex flex-col space-y-2">
                  {/* Menu Items */}
                  {!user && (
                    <>
                      <Button
                        variant="ghost"
                        asChild
                        className="h-12 justify-start"
                      >
                        <Link
                          href="/pricing"
                          onClick={handleMobileMenuItemClick}
                        >
                          Pricing
                        </Link>
                      </Button>
                      <Separator className="my-1" />
                    </>
                  )}

                  {/* Dashboard link when authenticated user is on home page */}
                  {user && pathname === "/" && (
                    <>
                      <Button
                        variant="ghost"
                        asChild
                        className="h-12 justify-start"
                        data-testid="mobile-dashboard"
                      >
                        <Link
                          href="/dashboard"
                          onClick={handleMobileMenuItemClick}
                        >
                          Dashboard
                        </Link>
                      </Button>
                      <Separator className="my-1" />
                    </>
                  )}

                  <Button
                    variant="ghost"
                    asChild
                    className="h-12 justify-start"
                    data-testid="mobile-recover-secret"
                  >
                    <Link href="/decrypt" onClick={handleMobileMenuItemClick}>
                      Recover Secret
                    </Link>
                  </Button>

                  {loading ? (
                    // Show nothing while loading to avoid flash
                    <div className="h-9" />
                  ) : user ? (
                    // User is logged in - show upgrade button if not pro, and sign out
                    <>
                      <Separator className="my-1" />
                      {!checkingSubscription && !isProUser && (
                        <Button
                          asChild
                          className="h-12 justify-start"
                          onClick={handleMobileMenuItemClick}
                        >
                          <Link href="/pricing">Upgrade to Pro</Link>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={handleSignOut}
                        className="h-12 justify-start"
                      >
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    // User is not logged in - show sign in only (sign up is outside the menu)
                    <>
                      <Separator className="my-1" />
                      <Button
                        variant="ghost"
                        asChild
                        className="h-12 justify-start"
                      >
                        <Link
                          href="/auth/login"
                          onClick={handleMobileMenuItemClick}
                        >
                          Sign In
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </nav>
  )
}
