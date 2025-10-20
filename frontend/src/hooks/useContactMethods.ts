import { useSession } from "next-auth/react"
import { useEffect, useState, useMemo } from "react"

export interface ContactMethods {
  email: string
  phone: string
  telegram_username: string
  whatsapp: string
  signal: string
  preferred_method: "email" | "phone" | "both"
  check_in_days: number
}

export interface ContactMethodsDbInput {
  email?: string
  phone?: string
  preferredMethod?: "email" | "phone" | "both"
}

export function useContactMethods() {
  const [contactMethods, setContactMethods] = useState<ContactMethods[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { data: session } = useSession()

  const userId = useMemo(() => {
    return (session?.user as { id?: string })?.id
  }, [session])

  useEffect(() => {
    async function fetchContactMethods() {
      try {
        if (!userId) {
          setError("User not authenticated")
          setLoading(false)
          return
        }

        setContactMethods([])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchContactMethods()
    } else if (session === null) {
      setError("User not authenticated")
      setLoading(false)
    }
  }, [userId, session])

  const saveContactMethods = async (methods: ContactMethodsDbInput) => {
    try {
      if (!userId) {
        throw new Error("User not authenticated")
      }

      setContactMethods([])
      return {}
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "Failed to save contact methods",
      )
    }
  }

  return { contactMethods, loading, error, saveContactMethods }
}
