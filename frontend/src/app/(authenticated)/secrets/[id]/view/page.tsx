"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const supabase = createClient()

interface ViewSecretPageProps {
  params: { id: string }
}

interface Secret {
  id: string
  title: string
  recipient_name: string
  contact_method: string
  status: string
  check_in_days: number
  next_check_in: string
}

export default function ViewSecretPage({ params }: ViewSecretPageProps) {
  const [secret, setSecret] = useState<Secret | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchSecret = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push("/auth/login")
          return
        }

        const { data, error: fetchError } = await supabase
          .from("secrets")
          .select("*")
          .eq("id", params.id)
          .eq("user_id", user.id)
          .single()

        if (fetchError || !data) {
          setError("Secret not found")
        } else {
          setSecret(data)
        }
      } catch {
        setError("Failed to load secret")
      } finally {
        setLoading(false)
      }
    }

    fetchSecret()
  }, [params.id, router])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!secret) return <div>Secret not found</div>

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">View Secret</h1>
      <Card>
        <CardHeader>
          <CardTitle>{secret.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <strong>Recipient:</strong> {secret.recipient_name}
            </div>
            <div>
              <strong>Contact Method:</strong> {secret.contact_method}
            </div>
            <div>
              <strong>Status:</strong> {secret.status}
            </div>
            <div>
              <strong>Check-in Days:</strong> {secret.check_in_days}
            </div>
            <div>
              <strong>Next Check-in:</strong>{" "}
              {new Date(secret.next_check_in).toLocaleDateString()}
            </div>
          </div>
          <div className="mt-6">
            <Button onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
