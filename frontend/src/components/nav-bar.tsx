"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { DevTierToggle } from "@/components/dev-tier-toggle"
import { WelcomeToProModal } from "@/components/subscription/WelcomeToProModal"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useConfig } from "@/contexts/ConfigContext"
import { Menu, Crown, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"

export function NavBar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { config } = useConfig()
  const [userTier, setUserTier] = useState<"free" | "pro">("free")
  const [checkingSubscription, setCheckingSubscription] = useState(false)
  const [proModalOpen, setProModalOpen] = useState(false)

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
  }

  return (
    <nav className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Dashboard Link */}
          <div className="flex items-center space-x-4">
            <Link
              href={user ? "/dashboard" : "/"}
              className="text-xl font-bold"
            >
              {config?.company || "KeyFate"}
            </Link>
            {user && pathname !== "/dashboard" && (
              <Button variant="ghost" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            )}
          </div>

          {/* Unified Menu for Desktop and Mobile */}
          <div className="flex items-center space-x-2">
            <ThemeToggle />

            {!checkingSubscription && isProUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProModalOpen(true)}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Crown className="mr-2 h-4 w-4" />
                Pro
              </Button>
            )}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  data-testid="mobile-menu-trigger"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" data-testid="dropdown-content">
                {!user && (
                  <>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/pricing" className="w-full">Pricing</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {user && (
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/settings" className="w-full flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem asChild data-testid="mobile-recover-secret" className="cursor-pointer">
                  <Link href="/decrypt" className="w-full">Recover Secret</Link>
                </DropdownMenuItem>

                {!loading && (
                  <>
                    {user ? (
                      <>
                        <DropdownMenuSeparator />
                        {!checkingSubscription && !isProUser && (
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href="/pricing" className="w-full">Upgrade to Pro</Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                          Sign Out
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href="/sign-in" className="w-full">Sign In</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href="/sign-in" className="w-full">Sign Up</Link>
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <WelcomeToProModal open={proModalOpen} onOpenChange={setProModalOpen} />
    </nav>
  )
}
