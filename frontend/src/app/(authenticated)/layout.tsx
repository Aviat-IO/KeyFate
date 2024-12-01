import { NavBar } from "@/components/nav-bar"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerComponentClient({
    cookies,
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error("[AuthenticatedLayout] Auth error:", userError)
    redirect("/auth/login")
  }

  return (
    <div className="bg-background min-h-screen">
      <NavBar user={user} />
      {children}
    </div>
  )
}
