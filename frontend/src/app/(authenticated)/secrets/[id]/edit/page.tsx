import { EditSecretForm } from "@/components/forms/editSecretForm"
import { authConfig } from "@/lib/auth-config"
import { getSecret } from "@/lib/db/operations"
import { getPrimaryRecipient } from "@/lib/types/secret-types"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"
import { notFound, redirect } from "next/navigation"

interface EditSecretPageProps {
  params: Promise<{ id: string }>
}

export default async function EditSecretPage({ params }: EditSecretPageProps) {
  const { id } = await params
  const session = (await getServerSession(authConfig as any)) as Session | null

  if (!session?.user) {
    redirect("/auth/signin")
  }

  // Get secret using our database operations
  try {
    const secret = await getSecret(id, session.user.id)
    if (!secret) {
      notFound()
    }

    const primaryRecipient = getPrimaryRecipient(secret.recipients)

    const initialData = {
      title: secret.title,
      recipient_name: primaryRecipient?.name || "",
      recipient_email: primaryRecipient?.email || "",
      recipient_phone: primaryRecipient?.phone || "",
      contact_method: (primaryRecipient?.email && primaryRecipient?.phone ? "both" : primaryRecipient?.email ? "email" : "phone") as "email" | "phone" | "both",
      check_in_days: secret.checkInDays,
    }

    return (
      <div className="mx-auto max-w-3xl py-8 sm:px-4">
        <h1 className="mb-6 text-3xl font-bold">Edit Secret</h1>
        <EditSecretForm initialData={initialData} secretId={secret.id} />
      </div>
    )
  } catch (error) {
    notFound()
  }
}
