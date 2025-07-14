import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/server"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

interface ViewSecretPageProps {
  params: Promise<{ id: string }>
}

export default async function ViewSecretPage({ params }: ViewSecretPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: secret, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error || !secret) {
    notFound()
  }

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
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
