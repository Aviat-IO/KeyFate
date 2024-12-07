import { EditSecretForm } from "@/components/forms/editSecretForm"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NEXT_PUBLIC_SITE_URL } from "@/lib/env"

interface PageParams {
  params: { id: string }
}

export default async function EditSecretPage({ params }: PageParams) {
  const { id } = await params
  const cookieStore = await cookies()

  // Fetch and decrypt the secret using the API route
  const response = await fetch(
    `${NEXT_PUBLIC_SITE_URL}/api/secrets/${id}?decrypt=true`,
    {
      cache: "no-store",
      headers: {
        cookie: cookieStore.toString(),
      },
    },
  )

  if (!response.ok) {
    console.error("Failed to fetch secret:", response.statusText)
    redirect("/dashboard")
  }

  const { secret } = await response.json()

  const initialData = {
    title: secret.title,
    message: secret.message, // This will be already decrypted from the API
    recipient_name: secret.recipient_name,
    recipient_email: secret.recipient_email || "",
    recipient_phone: secret.recipient_phone || "",
    contact_method: secret.contact_method,
    check_in_days: secret.check_in_days,
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Edit Secret</h1>
      <div className="mx-auto max-w-2xl">
        <EditSecretForm initialData={initialData} secretId={secret.id} />
      </div>
    </div>
  )
}
