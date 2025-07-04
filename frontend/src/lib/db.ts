"use server";

// TODO: Ensure this is secure. Or maybe we need to use admin and the service role key?
import { supabase as baseSupabase } from "@/lib/supabase";
import { Database, SecretInsert, SecretUpdate, Tables } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Explicitly type the supabase client
const supabase = baseSupabase as SupabaseClient<Database>;

// Create a single supabase client for interacting with your database
// const supabase = createClient<Database>(API_URL, ANON_KEY, {
//   auth: {
//     autoRefreshToken: false,
//     persistSession: false,
//   },
// });

// Convert db.secrets.getAll to individual export
export async function getAllSecrets(
  userId: string,
): Promise<Tables<"secrets">[]> {
  "use server";
  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Tables<"secrets">[];
}

// Add "use server" to each function
export async function getSecret(
  id: string,
  userId: string,
): Promise<Tables<"secrets">> {
  "use server";
  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data as Tables<"secrets">;
}

export async function createSecret(
  secret: SecretInsert,
): Promise<Tables<"secrets">> {
  "use server";
  const result = await supabase
    .from("secrets")
    .insert([secret])
    .select()
    .single();

  if (result.error) throw result.error;
  return result.data as Tables<"secrets">;
}

export async function updateSecret(
  id: string,
  updates: SecretUpdate,
): Promise<Tables<"secrets">> {
  "use server";
  const { data, error } = await supabase
    .from("secrets")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Tables<"secrets">;
}

export async function deleteSecret(id: string): Promise<void> {
  "use server";
  const { error } = await supabase.from("secrets").delete().eq("id", id);
  if (error) throw error;
}

export async function getOverdueSecrets(): Promise<Tables<"secrets">[]> {
  "use server";
  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("status", "active")
    .lt("next_check_in", new Date().toISOString());

  if (error) throw error;
  return data as Tables<"secrets">[];
}

export async function getSecretWithOwnership(
  id: string,
  userId: string,
): Promise<Tables<"secrets">> {
  "use server";
  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data as Tables<"secrets">;
}
