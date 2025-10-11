"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { DevTierToggle } from "@/components/dev-tier-toggle"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useConfig } from "@/contexts/ConfigContext"
import { Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"

export function NavBar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { config } = useConfig()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userTier, setUserTier] = useState<"free" | "pro">("free")
  const [checkingSubscription, setCheckingSubscription] = useState(false)

  const user = session?.user as { id?: string; name?: string; email?: string; image?: string } | undefined
  const loading = status === "loading"

  // Fetch user tier on mount and when session changes
  useEffect(() => {
    async function fetchUserTier() {
      if (!user?.id) return

      setCheckingSubscription(true)
      try {
        const response = await fetch("/api/user/subscription")
        if (response.ok) {
          const data = await response.json()
          setUserTier(data.tier?.name === "pro" ? "pro" : "free")
        }
      } catch (error) {
        console.error("Failed to fetch user tier:", error)
      } finally {
        setCheckingSubscription(false)
      }
    }

    fetchUserTier()
  }, [user?.id])

  const isProUser = userTier === "pro"

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/sign-in" })
    setMobileMenuOpen(false) // Close mobile menu
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
              {config?.company || "KeyFate"}
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
              // User is logged in - show dev toggle, upgrade button if not pro, and sign out
              <>
                <DevTierToggle currentTier={userTier} />
                {!checkingSubscription && !isProUser && (
                  <Button variant="outline" asChild className="border-primary hover:bg-primary hover:text-primary-foreground">
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
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-in">Sign Up</Link>
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
                <Link href="/sign-in">Sign Up</Link>
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
                    // User is logged in - show dev toggle, upgrade button if not pro, and sign out
                    <>
                      <Separator className="my-1" />
                      <div className="px-3 py-2">
                        <DevTierToggle currentTier={userTier} />
                      </div>
                      {!checkingSubscription && !isProUser && (
                        <Button
                          variant="outline"
                          asChild
                          className="h-12 justify-start border-primary hover:bg-primary hover:text-primary-foreground"
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
                          href="/sign-in"
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
