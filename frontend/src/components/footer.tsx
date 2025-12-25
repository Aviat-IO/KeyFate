"use client"

import { useConfig } from "@/contexts/ConfigContext"
import { NEXT_PUBLIC_SUPPORT_EMAIL } from "@/lib/env"
import Image from "next/image"
import Link from "next/link"

export function Footer() {
  const { config } = useConfig()
  return (
    <footer className="border-t border-border/50 bg-background px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-2">
          <Image
            src="/img/icon-light.png"
            alt={config?.company || "KeyFate"}
            width={32}
            height={32}
            className="block h-8 w-8 dark:hidden"
          />
          <Image
            src="/img/icon-dark.png"
            alt={config?.company || "KeyFate"}
            width={32}
            height={32}
            className="hidden h-8 w-8 dark:block"
          />
          <span className="font-semibold">{config?.company || "KeyFate"}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-foreground/60">
          <Link
            href="/faq"
            className="transition-colors hover:text-foreground"
          >
            FAQ
          </Link>
          <Link
            href="/pricing"
            className="transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            href="/blog"
            className="transition-colors hover:text-foreground"
          >
            Blog
          </Link>
          <Link
            href="/privacy-policy"
            className="transition-colors hover:text-foreground"
          >
            Privacy
          </Link>
          <Link
            href="/terms-of-service"
            className="transition-colors hover:text-foreground"
          >
            Terms
          </Link>
          <a
            href={`mailto:${NEXT_PUBLIC_SUPPORT_EMAIL}`}
            className="transition-colors hover:text-foreground"
          >
            Contact
          </a>
          <a
            href="https://github.com/Aviat-IO/keyfate"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </div>

        <p className="text-sm text-foreground/50">
          Zero-knowledge security. Open source.
        </p>
      </div>
    </footer>
  )
}
