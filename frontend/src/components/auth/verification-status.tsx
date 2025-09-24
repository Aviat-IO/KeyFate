"use client"

import { AlertCircle, CheckCircle2, Clock, Mail } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

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
  className
}: VerificationStatusProps) {
  if (error) {
    return (
      <Alert variant="destructive" className={className} data-testid="verification-error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (isVerified) {
    return (
      <Alert className={`border-green-200 bg-green-50 ${className}`} data-testid="verification-success">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Your email address <strong>{email}</strong> has been verified successfully.
        </AlertDescription>
      </Alert>
    )
  }

  if (isPending) {
    return (
      <Alert className={`border-yellow-200 bg-yellow-50 ${className}`} data-testid="verification-pending">
        <Clock className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          Verification in progress for <strong>{email}</strong>...
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-3 ${className}`} data-testid="verification-info">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-blue-600" />
        <span className="text-sm text-gray-700">
          Verification email sent to <strong>{email}</strong>
        </span>
        <Badge variant="outline" className="text-xs">
          Unverified
        </Badge>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <AlertDescription className="text-blue-800">
          Please check your email inbox and click the verification link to complete the process.
        </AlertDescription>
      </Alert>
    </div>
  )
}