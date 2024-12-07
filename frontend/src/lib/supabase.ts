import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_API_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_ANON_KEY!;

// Create a single instance of the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: "app-storage-key", // Use a unique storage key
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
