import type { Database } from "@/lib/database.types";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
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

export function useContactMethods() {
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactMethods, setContactMethods] = useState<ContactMethods | null>(
    null,
  );
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadContactMethods() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) return;

        setUserId(user.id);

        const { data: methods, error: methodsError } = await supabase
          .from("user_contact_methods")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (methodsError && methodsError.code !== "PGRST116") {
          throw methodsError;
        }

        if (methods) {
          setContactMethods({
            email: methods.email || "",
            phone: methods.phone || "",
            telegram_username: methods.telegram_username || "",
            whatsapp: methods.whatsapp || "",
            signal: methods.signal || "",
            preferred_method: methods.preferred_method,
            check_in_days: methods.check_in_days || 90,
          });
        }
      } catch (error) {
        console.error("Error loading contact methods:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load contact methods",
        );
      } finally {
        setLoading(false);
      }
    }

    loadContactMethods();
  }, [supabase]);

  const saveContactMethods = async (methods: ContactMethods) => {
    if (!userId) throw new Error("Not authenticated");

    const hasContactMethod = Object.entries(methods).some(
      ([key, value]) =>
        key !== "preferred_method" &&
        typeof value === "string" &&
        value.trim() !== "",
    );

    if (!hasContactMethod) {
      throw new Error("At least one contact method is required");
    }

    const { error } = await supabase.from("user_contact_methods").upsert({
      user_id: userId,
      ...methods,
    });

    if (error) throw error;
    setContactMethods(methods);
  };

  return {
    loading,
    error,
    contactMethods,
    saveContactMethods,
  };
}
