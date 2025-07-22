import { SecretCard } from "@/components/secret-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { createClient } from "@/utils/supabase/server"
import Link from "next/link"
import { Suspense } from "react"

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
      <div className="mx-auto max-w-2xl">
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
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">
      {secrets.map((secret) => (
        <SecretCard key={secret.id} secret={secret} />
      ))}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <LoadingIndicator text="Loading your secrets..." size="md" />
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

      <Suspense fallback={<LoadingSkeleton />}>
        <SecretsLoader />
      </Suspense>
    </div>
  )
}
