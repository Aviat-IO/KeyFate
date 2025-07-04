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
  initialValues?: ContactMethods | null
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
  initialValues,
  submitLabel = "Save Changes",
  showCancel = false,
  onCancel,
}: ContactMethodsFormProps) {
  const [formData, setFormData] = useState<ContactMethods>(
    initialValues || defaultContactMethods,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsLoading(true)
    setError(null)

    try {
      await onSubmit(formData)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to save contact methods")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (
    field: keyof ContactMethods,
    value: string | number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
    }
  }

  return (
    <div>
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
            placeholder="Your email address"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Phone</label>
          <Input
            type="tel"
            placeholder="Your phone number"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Telegram Username</label>
          <Input
            type="text"
            placeholder="Your telegram username"
            value={formData.telegram_username}
            onChange={(e) =>
              handleInputChange("telegram_username", e.target.value)
            }
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">WhatsApp</label>
          <Input
            type="tel"
            placeholder="Your whatsapp number"
            value={formData.whatsapp}
            onChange={(e) => handleInputChange("whatsapp", e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Signal</label>
          <Input
            type="tel"
            placeholder="Your signal number"
            value={formData.signal}
            onChange={(e) => handleInputChange("signal", e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Preferred Contact Method
          </label>
          <Select
            value={formData.preferred_method}
            onValueChange={(value) =>
              handleInputChange("preferred_method", value)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="both">Both Email and Phone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Check-in Days</label>
          <Input
            type="number"
            value={formData.check_in_days}
            onChange={(e) =>
              handleInputChange("check_in_days", parseInt(e.target.value))
            }
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="flex justify-end space-x-4">
          {showCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}
