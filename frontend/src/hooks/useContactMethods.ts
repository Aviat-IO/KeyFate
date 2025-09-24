import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export interface ContactMethods {
  email: string;
  phone: string;
  telegram_username: string;
  whatsapp: string;
  signal: string;
  preferred_method: "email" | "phone" | "both";
  check_in_days: number;
}

export interface ContactMethodsDbInput {
  email?: string;
  phone?: string;
  preferredMethod?: "email" | "phone" | "both";
}

export function useContactMethods() {
  const [contactMethods, setContactMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    async function fetchContactMethods() {
      try {
        if (!(session?.user as any)?.id) {
          setError("User not authenticated");
          setLoading(false);
          return;
        }

        // TODO: Call API endpoint for contact methods
        // const response = await fetch('/api/user/contact-methods');
        // const data = await response.json();
        // setContactMethods(data || []);

        // Temporarily return empty array during migration
        setContactMethods([]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    if ((session?.user as any)?.id) {
      fetchContactMethods();
    } else if (session === null) {
      // Session is explicitly null (not loading)
      setError("User not authenticated");
      setLoading(false);
    }
  }, [(session?.user as any)?.id]);

  const saveContactMethods = async (methods: ContactMethodsDbInput) => {
    try {
      if (!(session?.user as any)?.id) {
        throw new Error("User not authenticated");
      }

      // TODO: Call API endpoint to save contact methods
      // const response = await fetch('/api/user/contact-methods', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(methods)
      // });
      //
      // if (!response.ok) {
      //   throw new Error('Failed to save contact methods');
      // }

      // Temporarily return mock result during migration
      setContactMethods([]);
      return {};
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "Failed to save contact methods",
      );
    }
  };

  return { contactMethods, loading, error, saveContactMethods };
}
