"use server";

// TODO: Ensure this is secure. Or maybe we need to use admin and the service role key?
import { supabase } from "@/lib/supabase";
import { SecretInsert, SecretUpdate } from "@/types";

// Create a single supabase client for interacting with your database
// const supabase = createClient<Database>(API_URL, ANON_KEY, {
//   auth: {
//     autoRefreshToken: false,
//     persistSession: false,
//   },
// });

// Convert db.secrets.getAll to individual export
export async function getAllSecrets(userId: string) {
  "use server";
  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// Add "use server" to each function
export async function getSecret(id: string, userId: string) {
  "use server";
  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function createSecret(
  secret: SecretInsert,
) {
  "use server";
  const { data, error } = await supabase
    .from("secrets")
    .insert([secret])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSecret(
  id: string,
  secret: Partial<SecretUpdate>,
) {
  "use server";
  const { data, error } = await supabase
    .from("secrets")
    .update(secret)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSecret(id: string) {
  "use server";
  const { error } = await supabase.from("secrets").delete().eq("id", id);

  if (error) throw error;
}

export async function getOverdueSecrets() {
  "use server";
  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("status", "active")
    .lt("next_check_in", new Date().toISOString());

  if (error) throw error;
  return data;
}
