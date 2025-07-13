import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { ReactNode } from "react"
import { NavBar } from "@/components/nav-bar"

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

  return (
    <>
      <NavBar />
      <main>{children}</main>
    </>
  )
}
