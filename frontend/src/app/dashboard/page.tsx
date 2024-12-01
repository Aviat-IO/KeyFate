import { NavBar } from "@/components/nav-bar"
import { Button } from "@/components/ui/button"
import type { Database } from "@/lib/database.types"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { AlertCircle, PlusCircle } from "lucide-react"
import { cookies } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { SecretCard } from "@/components/secret-card"

interface Secret {
  id: string
  title: string
  recipient_name: string
  status: "active" | "paused" | "triggered"
  next_check_in: string
  last_check_in: string
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient<Database>({
    cookies: () => cookieStore,
  })

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("[DashboardPage] Auth error:", userError)
      redirect("/auth/login")
    }

    // Fetch secrets directly using Supabase client
    const { data: secrets, error: secretsError } = await supabase
      .from("secrets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<Secret[]>()

    if (secretsError) {
      console.error("[DashboardPage] Secrets error:", secretsError)
      throw new Error("Failed to fetch secrets")
    }

    return (
      <div className="bg-background min-h-screen">
        <NavBar user={user} />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Keep your secrets safe by checking in regularly
              </p>
            </div>
            <Button asChild>
              <Link href="/secrets/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Secret
              </Link>
            </Button>
          </div>

          {!secrets || secrets.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-12 text-center">
              <div className="mx-auto max-w-sm">
                <AlertCircle className="text-muted-foreground mx-auto h-12 w-12" />
                <h2 className="mt-4 text-lg font-semibold">No secrets yet</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Create your first dead man's switch secret to get started.
                  Your secret will only be revealed if you fail to check in.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/secrets/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Your First Secret
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {secrets.map((secret) => (
                <SecretCard secret={secret} key={secret.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  } catch (error) {
    console.error("[DashboardPage] Error:", error)
    redirect("/auth/login")
  }
}
