import { Database } from "@/types/database.types";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

type ContactMethod =
  Database["public"]["Tables"]["user_contact_methods"]["Row"];

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
  email: string;
  phone: string;
  preferred_method: "email" | "phone" | "both";
}

const supabase = createClient();

export function useContactMethods() {
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContactMethods() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("User not authenticated");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("user_contact_methods")
          .select("*")
          .eq("user_id", user.id);

        if (fetchError) {
          setError(fetchError.message);
        } else {
          setContactMethods(data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchContactMethods();
  }, []);

  const saveContactMethods = async (methods: ContactMethodsDbInput) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const { error: upsertError } = await supabase
        .from("user_contact_methods")
        .upsert({
          user_id: user.id,
          email: methods.email,
          phone: methods.phone,
          preferred_method: methods.preferred_method,
        })
        .eq("user_id", user.id);

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      // Refresh the contact methods
      const { data, error: fetchError } = await supabase
        .from("user_contact_methods")
        .select("*")
        .eq("user_id", user.id);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setContactMethods(data || []);
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "Failed to save contact methods",
      );
    }
  };

  return { contactMethods, loading, error, saveContactMethods };
}
