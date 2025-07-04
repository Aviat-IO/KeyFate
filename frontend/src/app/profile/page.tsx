"use client"

import { ContactMethodsForm } from "@/components/contact-methods-form"
import { useContactMethods } from "@/hooks/useContactMethods"
import { useToast } from "@/hooks/use-toast"

export default function ProfilePage() {
  const { loading, contactMethods, saveContactMethods } = useContactMethods()
  const { toast } = useToast()

  const handleSave = async (methods: {
    email?: string
    phone?: string
    preferred_method?: "email" | "phone" | "both"
  }) => {
    try {
      await saveContactMethods(methods)
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Profile Settings</h1>
      <div className="max-w-md">
        <ContactMethodsForm
          initialValues={contactMethods}
          onSubmit={handleSave}
        />
      </div>
    </div>
  )
}
