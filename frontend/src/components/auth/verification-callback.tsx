"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface VerificationCallbackProps {
  onSuccess?: (email: string) => void
  onError?: (error: string) => void
  redirectUrl?: string
  className?: string
}

export function VerificationCallback({
  onSuccess,
  onError,
  redirectUrl = '/dashboard',
  className
}: VerificationCallbackProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    const emailParam = searchParams.get('email')

    if (!token || !emailParam) {
      setStatus('error')
      setMessage('Invalid verification link. Please check your email and try again.')
      onError?.('Invalid verification link')
      return
    }

    verifyEmail(token, emailParam)
  }, [searchParams])

  const verifyEmail = async (token: string, emailAddress: string) => {
    try {
      const response = await fetch('/api/auth/verify-email-nextauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email: emailAddress,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setStatus('success')
        setMessage('Your email has been verified successfully!')
        setEmail(emailAddress)
        onSuccess?.(emailAddress)

        // Auto-redirect after 3 seconds
        setTimeout(() => {
          router.push(redirectUrl)
        }, 3000)
      } else {
        setStatus('error')
        setMessage(result.error || 'Email verification failed. Please try again.')
        onError?.(result.error || 'Verification failed')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setStatus('error')
      setMessage('Network error. Please check your connection and try again.')
      onError?.('Network error')
    }
  }

  const handleContinue = () => {
    router.push(redirectUrl)
  }

  const handleResendEmail = () => {
    router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`)
  }

  if (status === 'loading') {
    return (
      <div className={`flex min-h-screen items-center justify-center ${className}`}>
        <Card data-testid="verification-callback-loading">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-16 w-16 text-blue-600 mx-auto animate-spin" />
              <div>
                <h3 className="text-lg font-semibold">Verifying your email...</h3>
                <p className="text-sm text-muted-foreground">
                  Please wait while we confirm your email address.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className={`flex min-h-screen items-center justify-center ${className}`}>
        <Card data-testid="verification-callback-success" className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-green-600">Email Verified!</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Redirecting to dashboard in 3 seconds...
                </p>
              </div>
              <Button onClick={handleContinue} className="w-full">
                Continue to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`flex min-h-screen items-center justify-center ${className}`}>
      <Card data-testid="verification-callback-error" className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-6">
            <AlertCircle className="h-16 w-16 text-red-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-red-600">Verification Failed</h3>
              <Alert variant="destructive" className="mt-4 text-left">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            </div>

            <div className="space-y-3">
              {email && (
                <Button onClick={handleResendEmail} variant="outline" className="w-full">
                  Request New Verification Email
                </Button>
              )}
              <Button onClick={() => router.push('/sign-in')} variant="ghost" className="w-full">
                Back to Sign In
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}