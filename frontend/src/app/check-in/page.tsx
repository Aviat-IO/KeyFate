"use client"

import { CheckCircle2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function CheckInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  )
  const [message, setMessage] = useState("")
  const [secretTitle, setSecretTitle] = useState("")
  const [nextCheckIn, setNextCheckIn] = useState("")

  useEffect(() => {
    async function processCheckIn() {
      if (!token) {
        router.push("/auth/login?next=/dashboard")
        return
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-in?token=${token}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
        )

        const data = await response.json()

        if (data.redirect) {
          router.push(data.redirect)
          return
        }

        if (data.error) {
          setStatus("error")
          setMessage(data.error)
          return
        }

        setStatus("success")
        setSecretTitle(data.secretTitle)
        setNextCheckIn(data.nextCheckIn)
      } catch (error) {
        setStatus("error")
        setMessage("An error occurred while processing your check-in.")
      }
    }

    processCheckIn()
  }, [token, router])

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">
            Processing your check-in...
          </h2>
          <p className="text-muted-foreground mt-2">Please wait a moment.</p>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="text-destructive text-2xl font-semibold">
            Check-in Failed
          </h2>
          <p className="text-muted-foreground mt-2">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="mt-4 text-2xl font-semibold">Check-in Successful!</h2>
        <p className="mt-2">
          You have successfully checked in for{" "}
          <span className="font-semibold">{secretTitle}</span>!
        </p>
        <p className="mt-2">
          Your secret now will be triggered at{" "}
          <span className="font-semibold">{nextCheckIn} UTC</span>.
        </p>
        <p className="text-muted-foreground mt-2">
          You will receive reminder notifications before then.
        </p>
      </div>
    </div>
  )
}
