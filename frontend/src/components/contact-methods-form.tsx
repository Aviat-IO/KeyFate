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
import type { ContactMethods } from "@/hooks/useContactMethods"
import { AlertCircle } from "lucide-react"
import { useState } from "react"
interface ContactMethodsFormProps {
  onSubmit: (methods: ContactMethods) => Promise<void>
  initialValues?: ContactMethods
  submitLabel?: string
  showCancel?: boolean
  onCancel?: () => void
}

const defaultContactMethods: ContactMethods = {
  email: "",
  phone: "",
  telegram_username: "",
  whatsapp: "",
  signal: "",
  preferred_method: "email",
  check_in_days: 90,
}

export function ContactMethodsForm({
  onSubmit,
  initialValues = defaultContactMethods,
  submitLabel = "Save Changes",
  showCancel = false,
  onCancel,
}: ContactMethodsFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactMethods, setContactMethods] =
    useState<ContactMethods>(initialValues)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
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
        <label className="text-sm font-medium">Telegram Username</label>
        <Input
          value={contactMethods.telegram_username}
          onChange={(e) =>
            setContactMethods({
              ...contactMethods,
              telegram_username: e.target.value,
            })
          }
          placeholder="Your Telegram username"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">WhatsApp</label>
        <Input
          type="tel"
          value={contactMethods.whatsapp}
          onChange={(e) =>
            setContactMethods({
              ...contactMethods,
              whatsapp: e.target.value,
            })
          }
          placeholder="Your WhatsApp number"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Signal</label>
        <Input
          type="tel"
          value={contactMethods.signal}
          onChange={(e) =>
            setContactMethods({ ...contactMethods, signal: e.target.value })
          }
          placeholder="Your Signal number"
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

      <div className="space-y-2">
        <label className="text-sm font-medium">Check-in Interval (days)</label>
        <Input
          type="number"
          min={1}
          max={365}
          defaultValue={90}
          value={contactMethods.check_in_days}
          onChange={(e) =>
            setContactMethods({
              ...contactMethods,
              check_in_days: parseInt(e.target.value) || 90,
            })
          }
        />
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
