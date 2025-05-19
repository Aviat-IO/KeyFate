import { NavBar } from "@/components/nav-bar"
import { Database } from "@/types"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient<Database>({
    // @ts-expect-error - Supabase auth helpers expect different cookie format
    cookies: () => cookieStore,
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    console.error("[AuthenticatedLayout] Auth error:", userError)
    return redirect("/auth/signout")
  }

  if (!user) {
    console.error("[AuthenticatedLayout] No user found")
    return redirect("/auth/login?signout=1")
  }

  return (
    <div className="bg-background min-h-screen">
      <NavBar user={user} />
      {children}
    </div>
  )
}
