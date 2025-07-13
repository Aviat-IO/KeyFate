import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { ReactNode } from "react"

interface AuthenticatedLayoutProps {
  children: ReactNode
}

export default async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <>{children}</>
}
