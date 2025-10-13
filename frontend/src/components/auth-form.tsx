import { Footer } from "@/components/footer"
import { NavBar } from "@/components/nav-bar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SocialButtons } from "@/components/ui/social-buttons"
import Link from "next/link"
import { ReactNode } from "react"

interface AuthFormProps {
  title: string
  description: ReactNode
  children: ReactNode
  leftLink: {
    href: string
    text: string
  }
  rightLink?: {
    text: string
    linkText: string
    href: string
  }
  hideSocialButtons?: boolean
}

export function AuthForm({
  title,
  description,
  children,
  leftLink,
  rightLink,
  hideSocialButtons = false,
}: AuthFormProps) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur">
        <NavBar />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hideSocialButtons && (
                <>
                  <SocialButtons />

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
                </>
              )}

              {children}

              <div className="flex items-center justify-between text-sm">
                <Link
                  href={leftLink.href}
                  className="text-primary hover:text-primary/90 hover:underline"
                >
                  {leftLink.text}
                </Link>
                {rightLink && (
                  <div>
                    <span className="text-muted-foreground">
                      {rightLink.text}{" "}
                    </span>
                    <Link
                      href={rightLink.href}
                      className="text-primary hover:text-primary/90 font-medium hover:underline"
                    >
                      {rightLink.linkText}
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}
