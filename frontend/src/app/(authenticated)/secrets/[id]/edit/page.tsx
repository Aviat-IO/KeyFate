import { EditSecretForm } from "@/components/forms/editSecretForm"
import { authConfig } from "@/lib/auth-config"
import { getSecret } from "@/lib/db/operations"
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

    const initialData = {
      title: secret.title,
      recipients: secret.recipients.length > 0 
        ? secret.recipients.map(r => ({
            name: r.name,
            email: r.email || "",
            phone: r.phone || "",
            isPrimary: r.isPrimary,
          }))
        : [{
            name: "",
            email: "",
            phone: "",
            isPrimary: true,
          }],
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
