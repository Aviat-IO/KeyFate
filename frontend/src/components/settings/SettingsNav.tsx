"use client"

import { cn } from "@/lib/utils"
import { CreditCard, FileText, User } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface SettingsNavProps {
  isProUser: boolean
}

export function SettingsNav({ isProUser }: SettingsNavProps) {
  const pathname = usePathname()

  const links = [
    {
      href: "/settings/general",
      label: "General",
      icon: User,
    },
    ...(isProUser
      ? [
        {
          href: "/settings/audit",
          label: "Audit Logs",
          icon: FileText,
        },
      ]
      : []),
    {
      href: "/settings/subscription",
      label: "Subscription",
      icon: CreditCard,
    },
  ]

  return (
    <nav className="space-y-1">
      {links.map((link) => {
        const Icon = link.icon
        const isActive = pathname === link.href

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
