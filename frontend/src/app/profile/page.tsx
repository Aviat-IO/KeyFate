"use client"

import { ContactMethodsForm } from "@/components/contact-methods-form"
import { useToast } from "@/hooks/use-toast"
import {
  useContactMethods,
  type ContactMethods,
  type ContactMethodsDbInput,
} from "@/hooks/useContactMethods"

export default function ProfilePage() {
  const { loading, contactMethods, saveContactMethods } = useContactMethods()
  const { toast } = useToast()

  const handleSave = async (methods: ContactMethods) => {
    try {
      // Extract only the fields that exist in the database
      const dbMethods: ContactMethodsDbInput = {
        email: methods.email,
        phone: methods.phone,
        preferred_method: methods.preferred_method,
      }
      await saveContactMethods(dbMethods)
      toast({
        title: "Success",
        description: "Contact methods updated successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update contact methods",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  // Convert database contact methods to form interface
  const firstContactMethod = contactMethods[0]
  const formInitialValues: ContactMethods | null = firstContactMethod
    ? {
        email: firstContactMethod.email || "",
        phone: firstContactMethod.phone || "",
        telegram_username: "", // Not in database
        whatsapp: "", // Not in database
        signal: "", // Not in database
        preferred_method: firstContactMethod.preferred_method,
        check_in_days: 90, // Default value
      }
    : null

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <h1 className="mb-8 text-3xl font-bold">Profile Settings</h1>

      <div className="space-y-8">
        <div>
          <h2 className="mb-4 text-xl font-semibold">Contact Methods</h2>
          <p className="text-muted-foreground mb-6">
            Configure how we can reach you for notifications and alerts.
          </p>
          <ContactMethodsForm
            onSubmit={handleSave}
            initialValues={formInitialValues}
          />
        </div>
      </div>
    </div>
  )
}
