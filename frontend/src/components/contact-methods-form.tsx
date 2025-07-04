import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Tables } from "@/types"
import { AlertCircle } from "lucide-react"
import { useState } from "react"

type ContactMethodData = {
  email?: string
  phone?: string
  preferred_method?: "email" | "phone" | "both"
}

interface ContactMethodsFormProps {
  onSubmit: (methods: ContactMethodData) => Promise<void>
  initialValues?: Tables<"user_contact_methods"> | null
  submitLabel?: string
  showCancel?: boolean
  onCancel?: () => void
}

export function ContactMethodsForm({
  onSubmit,
  initialValues,
  submitLabel = "Save Changes",
  showCancel = false,
  onCancel,
}: ContactMethodsFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactMethods, setContactMethods] = useState<ContactMethodData>({
    email: initialValues?.email || "",
    phone: initialValues?.phone || "",
    preferred_method: initialValues?.preferred_method || "email",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Validate that at least one contact method is provided
      if (!contactMethods.email?.trim() && !contactMethods.phone?.trim()) {
        throw new Error("Please provide at least one contact method")
      }

      await onSubmit(contactMethods)
    } catch (error) {
      console.error("Error saving contact methods:", error)
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save contact methods",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input
          type="email"
          value={contactMethods.email}
          onChange={(e) =>
            setContactMethods({ ...contactMethods, email: e.target.value })
          }
          placeholder="Your email address"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Phone</label>
        <Input
          type="tel"
          value={contactMethods.phone}
          onChange={(e) =>
            setContactMethods({ ...contactMethods, phone: e.target.value })
          }
          placeholder="Your phone number"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Preferred Contact Method</label>
        <Select
          value={contactMethods.preferred_method}
          onValueChange={(value: "email" | "phone" | "both") =>
            setContactMethods({
              ...contactMethods,
              preferred_method: value,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="How should we contact you?" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
            <SelectItem value="both">Both Email and Phone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end space-x-4">
        {showCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}
