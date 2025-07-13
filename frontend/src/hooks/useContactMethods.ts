import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Database } from "@/types/database.types";

type ContactMethod = Database["public"]["Tables"]["contact_methods"]["Row"];

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
          .from("contact_methods")
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

  return { contactMethods, loading, error };
}
