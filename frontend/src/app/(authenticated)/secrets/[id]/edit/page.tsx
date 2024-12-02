import { EditSecretForm } from "@/components/forms/editSecretForm"
import { decryptMessage } from "@/lib/encryption"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

interface PageParams {
  params: { id: string }
}

export default async function EditSecretPage({ params }: PageParams) {
  const { id } = await params
  const cookieStore = await cookies()
  // @ts-expect-error
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: secret, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error || !secret) {
    redirect("/dashboard")
  }

  // Decrypt the message on the server
  const decryptedMessage = await decryptMessage(
    secret.message,
    Buffer.from(secret.iv, "base64"),
    Buffer.from(secret.auth_tag, "base64"),
  )

  const initialData = {
    title: secret.title,
    message: decryptedMessage,
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
