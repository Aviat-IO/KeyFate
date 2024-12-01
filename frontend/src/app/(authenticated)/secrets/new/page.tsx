"use client"

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
import { Textarea } from "@/components/ui/textarea"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function NewSecretPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    recipient_name: "",
    recipient_email: "",
    recipient_phone: "",
    contact_method: "email",
    check_in_interval: "7", // days
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Calculate next check-in time
      const nextCheckIn = new Date()
      nextCheckIn.setDate(
        nextCheckIn.getDate() + parseInt(formData.check_in_interval),
      )

      const { error: insertError } = await supabase.from("secrets").insert([
        {
          user_id: user.id,
          title: formData.title,
          message: formData.message,
          recipient_name: formData.recipient_name,
          recipient_email:
            formData.contact_method !== "phone"
              ? formData.recipient_email
              : null,
          recipient_phone:
            formData.contact_method !== "email"
              ? formData.recipient_phone
              : null,
          contact_method: formData.contact_method,
          check_in_interval: `${formData.check_in_interval} days`,
          next_check_in: nextCheckIn.toISOString(),
        },
      ])

      if (insertError) throw insertError

      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error("Error creating secret:", error)
      setError(
        error instanceof Error ? error.message : "Failed to create secret",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Create New Secret</h1>
      <div className="mx-auto max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Secret Title</label>
            <Input
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="E.g., Important Documents Location"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Secret Message</label>
            <Textarea
              required
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              placeholder="Your secret message that will be revealed..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Recipient's Name</label>
            <Input
              required
              value={formData.recipient_name}
              onChange={(e) =>
                setFormData({ ...formData, recipient_name: e.target.value })
              }
              placeholder="Who should receive this secret?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Contact Method</label>
            <Select
              value={formData.contact_method}
              onValueChange={(value) =>
                setFormData({ ...formData, contact_method: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="How should we contact them?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="both">Both Email and Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formData.contact_method === "email" ||
            formData.contact_method === "both") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient's Email</label>
              <Input
                type="email"
                required
                value={formData.recipient_email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    recipient_email: e.target.value,
                  })
                }
                placeholder="Their email address"
              />
            </div>
          )}

          {(formData.contact_method === "phone" ||
            formData.contact_method === "both") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient's Phone</label>
              <Input
                type="tel"
                required
                value={formData.recipient_phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    recipient_phone: e.target.value,
                  })
                }
                placeholder="Their phone number"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Check-in Interval</label>
            <Select
              value={formData.check_in_interval}
              onValueChange={(value) =>
                setFormData({ ...formData, check_in_interval: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="How often should you check in?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Daily</SelectItem>
                <SelectItem value="7">Weekly</SelectItem>
                <SelectItem value="14">Every 2 weeks</SelectItem>
                <SelectItem value="30">Monthly</SelectItem>
                <SelectItem value="90">Every 3 months</SelectItem>
                <SelectItem value="180">Every 6 months</SelectItem>
                <SelectItem value="365">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Secret"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
