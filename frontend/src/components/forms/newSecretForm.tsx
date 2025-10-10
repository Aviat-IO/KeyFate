"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Textarea } from "@/components/ui/textarea"
import { secretFormSchema, type SecretFormValues } from "@/lib/schemas/secret"
import { zodResolver } from "@hookform/resolvers/zod"
import { Buffer } from "buffer"
import { AlertCircle, Info, LockIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import sss from "shamirs-secret-sharing"

interface NewSecretFormProps {
  isPaid?: boolean
}

export function NewSecretForm({ isPaid = false }: NewSecretFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<SecretFormValues>({
    resolver: zodResolver(secretFormSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      secretMessageContent: "",
      recipient_name: "",
      recipient_email: "",
      recipient_phone: "",
      contact_method: "email",
      check_in_days: "30",
      sss_shares_total: 3,
      sss_threshold: 2,
    },
  })

  const { isSubmitting } = form.formState

  async function onSubmit(data: SecretFormValues) {
    setError(null)

    try {
      // 1. Perform SSS split client-side
      const secretBuffer = Buffer.from(data.secretMessageContent, "utf8")
      const shares = sss.split(secretBuffer, {
        shares: data.sss_shares_total,
        threshold: data.sss_threshold,
      })
      // Ensure enough shares were generated (should always be true if sss.split succeeded)
      if (shares.length < data.sss_shares_total || shares.length === 0) {
        throw new Error("Failed to generate the required number of SSS shares.")
      }

      // 2. Designate shares
      const userManagedShares = []
      // Start from shares[1] as shares[0] is for the server
      for (let i = 1; i < shares.length; i++) {
        userManagedShares.push(shares[i].toString("hex"))
      }

      // 3. Send plain server share to API for server-side encryption
      const serverSharePlainHex = shares[0].toString("hex")

      const payload = {
        title: data.title,
        server_share: serverSharePlainHex, // Send plain share for server-side encryption
        recipient_name: data.recipient_name,
        recipient_email: data.recipient_email,
        recipient_phone: data.recipient_phone,
        contact_method: data.contact_method,
        check_in_days: parseInt(data.check_in_days, 10),
        sss_shares_total: data.sss_shares_total,
        sss_threshold: data.sss_threshold,
      }

      const response = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create secret via API")
      }

      if (!result.secretId) {
        throw new Error("API did not return a secret ID.")
      }

      if (result.warning) {
        setError(result.warning) // Display warning but proceed with redirect
      }

      // Store shares in localStorage with 2 hour expiry
      const expiresAt = Date.now() + 2 * 60 * 60 * 1000 // 2 hours in ms
      localStorage.setItem(
        `keyfate:userManagedShares:${result.secretId}`,
        JSON.stringify({ shares: userManagedShares, expiresAt }),
      )

      // Redirect to the new share instructions page (no shares in URL)
      const queryParams = new URLSearchParams({
        secretId: result.secretId,
        sss_shares_total: data.sss_shares_total.toString(),
        sss_threshold: data.sss_threshold.toString(),
        recipient_name: data.recipient_name,
        recipient_email: data.recipient_email || "",
      })
      router.push(
        `/secrets/${result.secretId}/share-instructions?${queryParams.toString()}`,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while creating the secret.",
      )
      console.error("Submit error:", err)
    }
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Creating Secret</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Secret Details Section */}
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Secret Details</h2>
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secret Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Example: Grandma's Recipe Book Location"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secretMessageContent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Secret Message <LockIcon className="ml-1 inline h-4 w-4" />
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Your secret message. This will be securely split into shares after submission."
                        rows={5}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      This message will be split using Shamir's Secret Sharing.
                      You'll manage the shares on the next page.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Recipient Information Section */}
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Recipient Information</h2>
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="recipient_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient's Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Jane Doe"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recipient_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient's Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        {...field}
                        placeholder="recipient@example.com"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      The email address where the recipient will receive secret disclosure notifications.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Check-in Settings Section */}
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Check-in Settings</h2>
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
                          disabled={isSubmitting}
                          placeholder="Enter custom days"
                        />
                      ) : (
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="7">1 week</SelectItem>
                            <SelectItem value="30">1 month</SelectItem>
                            <SelectItem value="365">1 year</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </FormControl>
                    <FormDescription>
                      {isPaid 
                        ? "How often you need to check in to keep the secret active. Minimum 2 days."
                        : "How often you need to check in to keep the secret active. Upgrade to set custom intervals."
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Advanced Settings Section */}
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">
              Advanced Settings
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                (optional)
              </span>
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="sss-config" className="border-0">
                <AccordionTrigger>
                  Secret Sharing Configuration
                </AccordionTrigger>
                <AccordionContent className="space-y-4 p-1">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Secret Sharing Details</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc space-y-1 pl-5">
                        <li>
                          Your secret message will be split into a number of
                          cryptographic "shares".
                        </li>
                        <li>
                          A minimum number of shares (threshold) will be required
                          to reconstruct the original message.
                        </li>
                        <li>
                          KeyFate will securely store one share (encrypted again
                          by our server). You will manage the others on the next
                          page.
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                    <FormField
                      control={form.control}
                      name="sss_shares_total"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Shares to Create</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="2"
                              max="10"
                              disabled={isSubmitting}
                              {...field}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val === "") {
                                  field.onChange("")
                                } else {
                                  const numValue = parseInt(val, 10)
                                  if (!isNaN(numValue)) {
                                    field.onChange(numValue)
                                  } else {
                                    field.onChange(val)
                                  }
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Total shares to split the secret into. Min 2, Max 10.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sss_threshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Shares Needed for Recovery (Threshold)
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="2"
                              max="10"
                              disabled={isSubmitting}
                              {...field}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val === "") {
                                  field.onChange("")
                                } else {
                                  const numValue = parseInt(val, 10)
                                  if (!isNaN(numValue)) {
                                    field.onChange(numValue)
                                  } else {
                                    field.onChange(val)
                                  }
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum shares to reconstruct. Min 2, Max 10. Must be
                            &lt;= total shares.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting
              ? "Processing & Encrypting..."
              : "Create Secret & Proceed to Share Management"}
          </Button>
        </form>
      </Form>
    </>
  )
}
