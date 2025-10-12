"use client"

import { DeleteConfirm } from "@/components/delete-confirm"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { z } from "zod"

const recipientSchema = z
  .object({
    name: z.string().min(1, "Recipient name is required"),
    email: z.string().email().nullable().optional().or(z.literal("")),
    phone: z.string().nullable().optional().or(z.literal("")),
  })
  .refine((data) => data.email || data.phone, {
    message: "Each recipient must have either an email or phone number",
    path: ["email"],
  })

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  recipients: z
    .array(recipientSchema)
    .min(1, "At least one recipient is required"),
  check_in_days: z
    .union([z.string(), z.number()])
    .transform((val) => {
      if (typeof val === "string") {
        const num = parseInt(val, 10)
        return isNaN(num) ? undefined : num
      }
      return val
    })
    .pipe(
      z
        .number({
          required_error: "Check-in days is required.",
          invalid_type_error: "Check-in days must be a number.",
        })
        .min(2, "Trigger deadline must be at least 2 days.")
        .max(365),
    ),
})

type FormData = z.infer<typeof formSchema>

interface EditSecretFormProps {
  initialData: {
    title: string
    recipients: Array<{
      name: string
      email?: string | null
      phone?: string | null
    }>
    check_in_days: number
  }
  secretId: string
  isPaid?: boolean
}

export function EditSecretForm({
  initialData,
  secretId,
  isPaid = false,
}: EditSecretFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: initialData,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "recipients",
  })

  async function onSubmit(values: FormData) {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/secrets/${secretId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update secret")
      }

      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error("Error updating secret:", error)
      setError(
        error instanceof Error ? error.message : "Failed to update secret",
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/secrets/${secretId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete secret")
      }

      // Close modal and redirect
      setShowDeleteModal(false)
      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error("Error deleting secret:", error)
      setError(
        error instanceof Error ? error.message : "Failed to delete secret",
      )
      setShowDeleteModal(false)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Secret Details Section */}
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Secret Details</h2>
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secret Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Example: Important Documents Location"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Recipients Section */}
          <div className="rounded-lg border p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recipients</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: "", email: "", phone: "" })}
                disabled={loading}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Recipient
              </Button>
            </div>
            <div className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Recipient {index + 1}</h3>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name={`recipients.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Recipient's name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`recipients.${index}.email`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="recipient@example.com"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`recipients.${index}.phone`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+1234567890"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Phone notifications are not yet supported
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Check-in Settings Section */}
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Check-in Settings</h2>
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="check_in_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trigger Deadline</FormLabel>
                    <FormControl>
                      {isPaid ? (
                        <Input
                          type="number"
                          {...field}
                          min="2"
                          max="365"
                          disabled={loading}
                          placeholder="Enter custom days"
                        />
                      ) : (
                        <Select
                          onValueChange={(value) =>
                            field.onChange(Number(value))
                          }
                          defaultValue={
                            field.value != null
                              ? String(field.value)
                              : undefined
                          }
                          disabled={loading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="How often should you check in?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="2">Daily</SelectItem>
                            <SelectItem value="7">Weekly</SelectItem>
                            <SelectItem value="14">Every 2 weeks</SelectItem>
                            <SelectItem value="30">Monthly</SelectItem>
                            <SelectItem value="90">Every 3 months</SelectItem>
                            <SelectItem value="180">Every 6 months</SelectItem>
                            <SelectItem value="365">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </FormControl>
                    <FormDescription>
                      {isPaid
                        ? "How often you need to check in to keep the secret active. Minimum 2 days."
                        : "How often you need to check in to keep the secret active. Upgrade to set custom intervals."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col justify-between space-y-3 pt-6 sm:flex-row sm:space-x-4 sm:space-y-0">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteModal(true)}
              disabled={loading || deleteLoading}
              className="w-full sm:w-auto"
            >
              Delete Secret
            </Button>
            <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading || deleteLoading}
                className="w-full sm:w-auto"
                data-testid="form-cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || deleteLoading}
                className="w-full sm:w-auto"
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </Form>

      <DeleteConfirm
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleDelete}
        title="Delete Secret"
        description="Are you sure you want to delete this secret? This action cannot be undone and the secret will be permanently removed."
        confirmText="Delete Secret"
        loading={deleteLoading}
      />
    </>
  )
}
