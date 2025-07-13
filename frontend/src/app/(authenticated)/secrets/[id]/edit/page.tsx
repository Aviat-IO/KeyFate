import { EditSecretForm } from "@/components/forms/editSecretForm"
import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"

interface EditSecretPageProps {
  params: { id: string }
}

export default async function EditSecretPage({ params }: EditSecretPageProps) {
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
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single()

  if (error || !secret) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Edit Secret</h1>
      <EditSecretForm secret={secret} />
    </div>
  )
}
