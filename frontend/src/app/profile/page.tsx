"use client";

import { NavBar } from "@/components/nav-bar";
import { ContactMethodsForm } from "@/components/contact-methods-form";
import { useContactMethods } from "@/hooks/useContactMethods";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const { loading, contactMethods, saveContactMethods } = useContactMethods();

  if (loading) {
    return (
      <div className="bg-background min-h-screen">
        <NavBar />
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-8 text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <NavBar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-2xl font-bold">Contact Methods</h1>
        <div className="mx-auto max-w-2xl">
          <ContactMethodsForm
            initialValues={contactMethods || undefined}
            onSubmit={async (methods) => {
              await saveContactMethods(methods);
              router.refresh();
            }}
          />
        </div>
      </div>
    </div>
  );
}
