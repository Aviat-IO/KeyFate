"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Clock, Mail } from "lucide-react"

interface VerificationStatusProps {
  email: string
  isVerified?: boolean
  isPending?: boolean
  error?: string | null
  className?: string
}

export function VerificationStatus({
  email,
  isVerified = false,
  isPending = false,
  error = null,
  className,
}: VerificationStatusProps) {
  if (error) {
    return (
      <Alert
        variant="destructive"
        className={className}
        data-testid="verification-error"
      >
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (isVerified) {
    return (
      <Alert
        className={`border-accent bg-accent/50 ${className}`}
        data-testid="verification-success"
      >
        <CheckCircle2 className="text-accent-foreground h-4 w-4" />
        <AlertDescription className="text-accent-foreground">
          Your email address <strong>{email}</strong> has been verified
          successfully.
        </AlertDescription>
      </Alert>
    )
  }

  if (isPending) {
    return (
      <Alert
        className={`border-muted bg-muted/50 ${className}`}
        data-testid="verification-pending"
      >
        <Clock className="text-muted-foreground h-4 w-4" />
        <AlertDescription className="text-muted-foreground">
          Verification in progress for <strong>{email}</strong>...
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-3 ${className}`} data-testid="verification-info">
      <div className="flex items-center gap-2">
        <Mail className="text-muted-foreground h-4 w-4" />
        <span className="text-foreground text-sm">
          Verification email sent to <strong>{email}</strong>
        </span>
        <Badge variant="outline" className="text-xs">
          Unverified
        </Badge>
      </div>

      <Alert className="border-muted bg-muted/50">
        <AlertDescription className="text-muted-foreground">
          Please check your email inbox and click the verification link to
          complete the process.
        </AlertDescription>
      </Alert>
    </div>
  )
}
