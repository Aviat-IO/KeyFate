import { SecretCard } from "@/components/secret-card"
import { Button } from "@/components/ui/button"
import { Suspense } from "react"
import { createClient } from "@/utils/supabase/server"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

async function SecretsLoader() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Please sign in to continue</div>
  }

  const { data: secrets } = await supabase
    .from("secrets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (!secrets || secrets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Secrets Yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            You haven't created any secrets yet. Get started by creating your
            first dead man's switch.
          </p>
          <Button asChild>
            <Link href="/secrets/new">Create Your First Secret</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {secrets.map((secret) => (
        <SecretCard key={secret.id} secret={secret} />
      ))}
    </div>
  )
}

export default async function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your Secrets</h1>
        <Button asChild>
          <Link href="/secrets/new">Create New Secret</Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 w-1/3 rounded bg-gray-200"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-gray-200"></div>
                    <div className="h-4 w-2/3 rounded bg-gray-200"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <SecretsLoader />
      </Suspense>
    </div>
  )
}
