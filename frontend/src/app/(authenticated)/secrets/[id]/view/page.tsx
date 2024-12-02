"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { AlertCircle, Clock } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { format } from "timeago.js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface Secret {
  id: string
  title: string
  message: string
  recipient_name: string
  recipient_email: string | null
  recipient_phone: string | null
  contact_method: "email" | "phone" | "both"
  check_in_days: string
  last_check_in: string | null
  next_check_in: string | null
  triggered_at: string | null
  is_triggered: boolean
}

export default function ViewSecretPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [secret, setSecret] = useState<Secret | null>(null)

  useEffect(() => {
    async function loadSecret() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const { data: secretData, error: secretError } = await supabase
          .from("secrets")
          .select("*")
          .eq("id", params.id)
          .eq("user_id", user.id)
          .single()

        if (secretError) throw secretError
        if (!secretData) throw new Error("Secret not found")
        if (!secretData.is_triggered) {
          // If the secret isn't triggered, redirect to edit page
          router.push(`/secrets/${params.id}/edit`)
          return
        }

        setSecret(secretData)
      } catch (error) {
        console.error("Error loading secret:", error)
        setError(
          error instanceof Error ? error.message : "Failed to load secret",
        )
      } finally {
        setLoading(false)
      }
    }

    loadSecret()
  }, [supabase, params.id, router])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-2xl font-bold">Loading...</h1>
      </div>
    )
  }

  if (!secret) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Secret not found"}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">View Triggered Secret</h1>
          <p className="text-muted-foreground mt-1">
            This secret has been triggered and sent to the recipient
          </p>
        </div>
        <Badge variant="destructive">Sent</Badge>
      </div>

      <div className="mx-auto max-w-2xl">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle>{secret.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Secret Message</h3>
                <p className="text-muted-foreground mt-1 whitespace-pre-line">
                  {secret.message}
                </p>
              </div>

              <div>
                <h3 className="font-medium">Recipient Details</h3>
                <div className="text-muted-foreground mt-1">
                  <p>Name: {secret.recipient_name}</p>
                  {secret.recipient_email && (
                    <p>Email: {secret.recipient_email}</p>
                  )}
                  {secret.recipient_phone && (
                    <p>Phone: {secret.recipient_phone}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="text-muted-foreground flex items-center text-sm">
                <Clock className="mr-2 h-4 w-4" />
                Triggered {format(secret.triggered_at!)}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
