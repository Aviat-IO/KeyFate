import { SecretDetailsForm } from "@/components/forms/secretDetailsForm"
import { Database, Secret } from "@/types"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

interface PageParams {
  params: Promise<{ id: string }>
}

export default async function SecretDetailsPage({ params }: PageParams) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerComponentClient<Database>({
    // @ts-expect-error - Supabase auth helpers expect different cookie format
    cookies: () => cookieStore,
  })

  // Get the authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/auth/login")
  }

  // Fetch secret metadata (no decryption needed for details view)
  const {
    data: secret,
    error: secretError,
  }: { data: Secret | null; error: Error | null } = await supabase
    .from("secrets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (secretError || !secret) {
    console.error("Failed to fetch secret:", secretError)
    redirect("/dashboard")
  }

  // If secret is triggered, redirect to view page
  if (secret.is_triggered) {
    redirect(`/secrets/${id}/view`)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Secret Details</h1>
      <div className="mx-auto max-w-2xl">
        <SecretDetailsForm secret={secret} />
      </div>
    </div>
  )
}
