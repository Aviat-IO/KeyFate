"use client"

import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface AuthLayoutProps {
  children: React.ReactNode
}

const supabase = createClient()

export default function AuthLayout({ children }: AuthLayoutProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        router.push("/dashboard")
      } else {
        setLoading(false)
      }
    }

    checkUser()
  }, [router])

  if (loading) {
    return <div>Loading...</div>
  }

  return <>{children}</>
}
