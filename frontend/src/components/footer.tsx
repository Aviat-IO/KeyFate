import {
  NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_PARENT_COMPANY,
} from "@/lib/env"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="bg-background border-t">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} {NEXT_PUBLIC_PARENT_COMPANY}. All
              rights reserved.
            </p>
            <p className="text-muted-foreground text-xs">
              Secure dead man's switch platform with 100% client-side Shamir's
              Secret Sharing
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm">
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
          </div>
        </div>
      </div>
    </footer>
  )
}
