import { NavBar } from "@/components/nav-bar"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { Database } from "@/lib/database.types"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient<Database>({
    // @ts-expect-error
    cookies: () => cookieStore,
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
