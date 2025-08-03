import { EditSecretForm } from "@/components/forms/editSecretForm"
import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"

interface EditSecretPageProps {
  params: Promise<{ id: string }>
}

export default async function EditSecretPage({ params }: EditSecretPageProps) {
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

  const initialData = {
    title: secret.title,
    recipient_name: secret.recipient_name,
    recipient_email: secret.recipient_email || "",
    recipient_phone: secret.recipient_phone || "",
    contact_method: secret.contact_method,
    check_in_days: secret.check_in_days,
  }

  return (
    <div className="mx-auto sm:px-4 py-8 max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">Edit Secret</h1>
      <EditSecretForm initialData={initialData} secretId={secret.id} />
    </div>
  )
}
