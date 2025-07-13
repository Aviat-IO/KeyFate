import { createBrowserClient } from "@supabase/ssr";
import {
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
} from "@/lib/env";
import { Database } from "@/types/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
