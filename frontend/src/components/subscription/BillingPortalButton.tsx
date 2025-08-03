"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false)

  const handlePortal = async () => {
    setLoading(true)

    try {
      const response = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.redirected) {
        window.location.href = response.url
      } else {
        console.error("Portal creation failed")
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handlePortal} disabled={loading} variant="outline">
      {loading ? "Loading..." : "Manage Billing"}
    </Button>
  )
}
