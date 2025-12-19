"use client"

import { useConfig } from "@/contexts/ConfigContext"
import { NEXT_PUBLIC_SUPPORT_EMAIL } from "@/lib/env"
import Link from "next/link"

export function Footer() {
  const { config } = useConfig()
  return (
    <footer className="bg-background border-t">
      <div className="mx-auto py-8 sm:px-4">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()}{" "}
              {config?.parentCompany || "Aviat, LLC"}. All rights reserved.
            </p>
            <p className="text-muted-foreground text-xs">
              Secure dead man's switch platform with 100% client-side Shamir's
              Secret Sharing
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm">
            <Link
              href="/blog"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/privacy-policy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms-of-service"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <a
              href={`mailto:${NEXT_PUBLIC_SUPPORT_EMAIL}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </a>
            <a
              href="https://github.com/Aviat-IO/keyfate"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
