"use client"

import { ContactMethodsForm } from "@/components/contact-methods-form"
import {
  useContactMethods,
  type ContactMethods,
} from "@/hooks/useContactMethods"
import { useToast } from "@/hooks/use-toast"

export default function ProfilePage() {
  const { loading, contactMethods, saveContactMethods } = useContactMethods()
  const { toast } = useToast()

  const handleSave = async (methods: ContactMethods) => {
    try {
      // Extract only the fields that exist in the database
      await saveContactMethods({
        email: methods.email || undefined,
        phone: methods.phone || undefined,
        preferred_method: methods.preferred_method as
          | "email"
          | "phone"
          | "both",
      })
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
            : "Failed to save contact methods",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  // Convert database contact methods to form interface
  const formInitialValues: ContactMethods | null = contactMethods
    ? {
        email: contactMethods.email || "",
        phone: contactMethods.phone || "",
        telegram_username: "", // Not in database
        whatsapp: "", // Not in database
        signal: "", // Not in database
        preferred_method: contactMethods.preferred_method,
        check_in_days: 90, // Not in user_contact_methods table
      }
    : null

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Profile Settings</h1>
      <div className="max-w-md">
        <ContactMethodsForm
          initialValues={formInitialValues}
          onSubmit={handleSave}
        />
      </div>
    </div>
  )
}
