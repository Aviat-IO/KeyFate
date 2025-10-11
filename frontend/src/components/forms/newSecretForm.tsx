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
import {
  AlertCircle,
  Info,
  LockIcon,
  Plus,
  Trash2,
  Crown,
  AlertTriangle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import sss from "shamirs-secret-sharing"
import { UpgradeModal } from "@/components/upgrade-modal"
import { ThresholdSelector } from "./ThresholdSelector"

interface NewSecretFormProps {
  isPaid?: boolean
  tierInfo?: {
    secretsUsed: number
    secretsLimit: number
    canCreate: boolean
    recipientsLimit: number
  }
}

export function NewSecretForm({
  isPaid = false,
  tierInfo,
}: NewSecretFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const form = useForm<SecretFormValues>({
    resolver: zodResolver(secretFormSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      secretMessageContent: "",
      recipients: [{ name: "", email: "" }],
      check_in_days: "7",
      sss_shares_total: 3,
      sss_threshold: 2,
    },
  })

  const { isSubmitting } = form.formState

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "recipients",
  })

  const maxRecipients = isPaid ? 5 : 1
  const canAddMore = fields.length < maxRecipients

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
        server_share: serverSharePlainHex,
        recipients: data.recipients,
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

      const queryParams = new URLSearchParams({
        secretId: result.secretId,
        sss_shares_total: data.sss_shares_total.toString(),
        sss_threshold: data.sss_threshold.toString(),
        recipients: encodeURIComponent(
          JSON.stringify(
            data.recipients.map((r) => ({ name: r.name, email: r.email })),
          ),
        ),
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

  const percentageUsed = tierInfo
    ? (tierInfo.secretsUsed / tierInfo.secretsLimit) * 100
    : 0

  const showWarning = tierInfo && percentageUsed >= 75 && tierInfo.canCreate
  const isAtLimit = tierInfo && !tierInfo.canCreate

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Creating Secret</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isAtLimit && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Secret Limit Reached</AlertTitle>
          <AlertDescription>
            You've used all {tierInfo.secretsLimit} of your{" "}
            {isPaid ? "Pro" : "Free"} tier secrets.
            {!isPaid && " Upgrade to Pro to create up to 10 secrets."}
          </AlertDescription>
        </Alert>
      )}

      {showWarning && (
        <Alert className="border-muted bg-muted/50 mb-6">
          <AlertTriangle className="text-muted-foreground h-4 w-4" />
          <AlertTitle className="text-foreground">Approaching Limit</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            You're using {tierInfo.secretsUsed} of {tierInfo.secretsLimit}{" "}
            secrets ({Math.round(percentageUsed)}%).
            {!isPaid && " Consider upgrading to Pro for 10 secrets."}
          </AlertDescription>
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
                      Secret Message{" "}
                      <LockIcon className="ml-1 inline h-4 w-4" />
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recipients</h2>
              {!isPaid && fields.length >= 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUpgradeModal(true)}
                  className="gap-2"
                >
                  <Crown className="h-3 w-3" />
                  Add More (Pro)
                </Button>
              )}
            </div>

            {isPaid &&
              maxRecipients > 0 &&
              fields.length >= Math.floor(maxRecipients * 0.75) && (
                <Alert className="border-muted bg-muted/50 mb-4">
                  <AlertTriangle className="text-muted-foreground h-4 w-4" />
                  <AlertDescription className="text-muted-foreground">
                    {fields.length >= maxRecipients
                      ? `Maximum ${maxRecipients} recipients reached.`
                      : `Using ${fields.length} of ${maxRecipients} recipients.`}
                  </AlertDescription>
                </Alert>
              )}

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      Recipient {index + 1}
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        disabled={isSubmitting}
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
                    name={`recipients.${index}.email`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            {...field}
                            placeholder="recipient@example.com"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}

              {isPaid && canAddMore && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ name: "", email: "" })}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Recipient ({fields.length} / {maxRecipients})
                </Button>
              )}

              {isPaid && !canAddMore && (
                <div className="text-muted-foreground py-2 text-center text-sm">
                  Maximum {maxRecipients} recipients reached
                </div>
              )}
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
                          {isPaid ? (
                            <>
                              <SelectItem value="1">1 day</SelectItem>
                              <SelectItem value="3">3 days</SelectItem>
                              <SelectItem value="7">1 week</SelectItem>
                              <SelectItem value="14">2 weeks</SelectItem>
                              <SelectItem value="30">1 month</SelectItem>
                              <SelectItem value="90">3 months</SelectItem>
                              <SelectItem value="180">6 months</SelectItem>
                              <SelectItem value="365">1 year</SelectItem>
                              <SelectItem value="1095">3 years</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="7">1 week</SelectItem>
                              <SelectItem value="30">1 month</SelectItem>
                              <SelectItem value="365">1 year</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      {isPaid
                        ? "How often you need to check in to keep the secret active."
                        : "How often you need to check in to keep the secret active. Upgrade to Pro for more interval options."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Advanced Settings Section */}
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">
              Advanced Settings
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                (optional)
              </span>
            </h2>
            <Accordion
              type="single"
              collapsible
              className="w-full"
              defaultValue={fields.length > 1 ? "sss-config" : undefined}
            >
              <AccordionItem value="sss-config" className="border-0">
                <AccordionTrigger>
                  Secret Sharing Configuration
                </AccordionTrigger>
                <AccordionContent className="space-y-4 p-1">
                  {fields.length > 1 && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Multiple Recipients</AlertTitle>
                      <AlertDescription>
                        All recipients will receive the SAME share. You must
                        distribute this share to each recipient separately via
                        your own secure channels. With multiple recipients,
                        consider your threshold carefully.
                      </AlertDescription>
                    </Alert>
                  )}
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
                          A minimum number of shares (threshold) will be
                          required to reconstruct the original message.
                        </li>
                        <li>
                          KeyFate will securely store one share (encrypted again
                          by our server). You will manage the others on the next
                          page.
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                  <ThresholdSelector
                    control={form.control}
                    isPro={isPaid}
                    isSubmitting={isSubmitting}
                    onUpgradeClick={() => setShowUpgradeModal(true)}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || isAtLimit}
            className="w-full"
          >
            {isSubmitting
              ? "Processing & Encrypting..."
              : isAtLimit
                ? "Secret Limit Reached - Upgrade Required"
                : "Create Secret & Proceed to Share Management"}
          </Button>
        </form>
      </Form>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature="multiple recipients per secret"
        currentLimit="1 recipient"
        proLimit="Up to 5 recipients"
      />
    </>
  )
}
