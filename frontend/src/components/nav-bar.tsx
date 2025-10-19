"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { WelcomeToProModal } from "@/components/subscription/WelcomeToProModal"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { useConfig } from "@/contexts/ConfigContext"
import { Crown, Settings, KeyRound, LogOut, Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import Image from "next/image"
import { cn } from "@/lib/utils"

export function NavBar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { config } = useConfig()
  const { resolvedTheme } = useTheme()
  const [userTier, setUserTier] = useState<"free" | "pro">("free")
  const [checkingSubscription, setCheckingSubscription] = useState(false)
  const [proModalOpen, setProModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const user = session?.user as
    | { id?: string; name?: string; email?: string; image?: string }
    | undefined
  const loading = status === "loading"

  useEffect(() => {
    setMounted(true)
  }, [])

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
          <div className="flex items-center space-x-4">
            <Link
              href={user ? "/dashboard" : "/"}
              className="flex items-center"
            >
              {mounted ? (
                <Image
                  src={
                    resolvedTheme === "dark"
                      ? "/img/icon-dark.png"
                      : "/img/icon-light.png"
                  }
                  alt={config?.company || "KeyFate"}
                  width={40}
                  height={40}
                  className="h-10 w-10 sm:hidden"
                  priority
                />
              ) : null}
              {mounted ? (
                <Image
                  src={
                    resolvedTheme === "dark"
                      ? "/img/logo-dark.png"
                      : "/img/logo-light.png"
                  }
                  alt={config?.company || "KeyFate"}
                  width={200}
                  height={40}
                  className="hidden h-10 w-auto sm:block"
                  priority
                />
              ) : (
                <div className="h-10 w-[200px]" />
              )}
            </Link>

            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList>
                {user && pathname !== "/dashboard" && (
                  <NavigationMenuItem>
                    <Link href="/dashboard" legacyBehavior passHref>
                      <NavigationMenuLink
                        className={navigationMenuTriggerStyle()}
                      >
                        Dashboard
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                )}

                <NavigationMenuItem>
                  <Link href="/decrypt" legacyBehavior passHref>
                    <NavigationMenuLink
                      className={navigationMenuTriggerStyle()}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Recover Secret
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>

                {!loading && !user && (
                  <NavigationMenuItem>
                    <Link href="/pricing" legacyBehavior passHref>
                      <NavigationMenuLink
                        className={navigationMenuTriggerStyle()}
                      >
                        Pricing
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                )}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="flex items-center space-x-2">
            <ThemeToggle />

            {!checkingSubscription && isProUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProModalOpen(true)}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground hidden md:flex"
              >
                <Crown className="h-4 w-4" />
                Pro
              </Button>
            )}

            {!loading && !user && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="hidden md:flex"
                >
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button variant="default" size="sm" asChild>
                  <Link href="/sign-up">Sign Up</Link>
                </Button>
              </>
            )}

            {user && (
              <NavigationMenu className="hidden justify-end md:flex">
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Account</NavigationMenuTrigger>
                    <NavigationMenuContent className="!left-auto !right-0">
                      <ul className="grid w-[200px] gap-1 p-2">
                        <li>
                          <NavigationMenuLink asChild>
                            <Link
                              href="/settings"
                              className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex select-none items-center gap-2 rounded-md px-3 py-2 leading-none no-underline outline-none transition-colors"
                            >
                              <Settings className="h-4 w-4" />
                              <span>Settings</span>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                        {!checkingSubscription && !isProUser && (
                          <li>
                            <NavigationMenuLink asChild>
                              <Link
                                href="/pricing"
                                className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex select-none items-center gap-2 rounded-md px-3 py-2 leading-none no-underline outline-none transition-colors"
                              >
                                <Crown className="h-4 w-4" />
                                <span>Upgrade to Pro</span>
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        )}
                        <li>
                          <button
                            onClick={handleSignOut}
                            className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex w-full select-none items-center gap-2 rounded-md px-3 py-2 text-left leading-none outline-none transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            <span>Sign Out</span>
                          </button>
                        </li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            )}

            <NavigationMenu className="md:hidden">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    className="h-9 px-3"
                    data-testid="mobile-menu-trigger"
                  >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Open menu</span>
                  </NavigationMenuTrigger>
                  <NavigationMenuContent data-testid="dropdown-content">
                    <ul className="grid w-[280px] gap-1 p-2">
                      {!user && (
                        <li>
                          <NavigationMenuLink asChild>
                            <Link
                              href="/pricing"
                              className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block select-none rounded-md px-3 py-2 leading-none no-underline outline-none transition-colors"
                            >
                              Pricing
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      )}

                      {user && (
                        <li>
                          <NavigationMenuLink asChild>
                            <Link
                              href="/settings"
                              className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex select-none items-center gap-2 rounded-md px-3 py-2 leading-none no-underline outline-none transition-colors"
                            >
                              <Settings className="h-4 w-4" />
                              Settings
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      )}

                      <li>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/decrypt"
                            className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex select-none items-center gap-2 rounded-md px-3 py-2 leading-none no-underline outline-none transition-colors"
                            data-testid="mobile-recover-secret"
                          >
                            <KeyRound className="h-4 w-4" />
                            Recover Secret
                          </Link>
                        </NavigationMenuLink>
                      </li>

                      {!loading && user && (
                        <>
                          {!checkingSubscription && !isProUser && (
                            <li>
                              <NavigationMenuLink asChild>
                                <Link
                                  href="/pricing"
                                  className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex select-none items-center gap-2 rounded-md px-3 py-2 leading-none no-underline outline-none transition-colors"
                                >
                                  <Crown className="h-4 w-4" />
                                  Upgrade to Pro
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          )}
                          <li>
                            <button
                              onClick={handleSignOut}
                              className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex w-full select-none items-center gap-2 rounded-md px-3 py-2 text-left leading-none outline-none transition-colors"
                            >
                              <LogOut className="h-4 w-4" />
                              Sign Out
                            </button>
                          </li>
                        </>
                      )}

                      {!loading && !user && (
                        <li>
                          <NavigationMenuLink asChild>
                            <Link
                              href="/sign-in"
                              className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block select-none rounded-md px-3 py-2 leading-none no-underline outline-none transition-colors"
                            >
                              Sign In
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      )}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>
      </div>
      <WelcomeToProModal open={proModalOpen} onOpenChange={setProModalOpen} />
    </nav>
  )
}
