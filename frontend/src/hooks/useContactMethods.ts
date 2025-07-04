import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database, Tables } from "@/types";

const supabase = createClientComponentClient<Database>();

// Legacy interface for backward compatibility with tests
export type ContactMethods = {
  email: string;
  phone: string;
  telegram_username: string;
  whatsapp: string;
  signal: string;
  preferred_method: "email" | "phone" | "both";
  check_in_days: number;
};

// Actual database type for user_contact_methods
type ContactMethodData = {
  email?: string;
  phone?: string;
  preferred_method?: Database["public"]["Enums"]["contact_method"];
};

export function useContactMethods() {
  const [contactMethods, setContactMethods] = useState<
    Tables<"user_contact_methods"> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContactMethods = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        setContactMethods(null);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("user_contact_methods")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      setContactMethods(data as Tables<"user_contact_methods"> | null);
    } catch (err) {
      console.error("Error fetching contact methods:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactMethods();
  }, []);

  const saveContactMethods = async (data: ContactMethodData) => {
    try {
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User not authenticated");

      // Check if contact methods exist
      const { data: existing } = await supabase
        .from("user_contact_methods")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { data: updated, error: updateError } = await supabase
          .from("user_contact_methods")
          .update({
            email: data.email || null,
            phone: data.phone || null,
            preferred_method: data.preferred_method || "email",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setContactMethods(updated as Tables<"user_contact_methods">);
      } else {
        // Insert new record
        const { error } = await supabase.from("user_contact_methods").upsert({
          user_id: user.id,
          email: data.email || null,
          phone: data.phone || null,
          preferred_method: data.preferred_method || "email",
        });

        if (error) throw error;
        await fetchContactMethods(); // Refetch to get the inserted data
      }
    } catch (err) {
      console.error("Error saving contact methods:", err);
      throw err;
    }
  };

  return {
    contactMethods,
    loading,
    error,
    saveContactMethods,
    refetch: fetchContactMethods,
  };
}
