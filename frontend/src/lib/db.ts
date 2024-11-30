"use server";

import type { Database } from "@/lib/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

// Create a single supabase client for interacting with your database
const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Convert db.secrets.getAll to individual export
export async function getAllSecrets(userId: string) {
  "use server";
  const { data, error } = await supabaseAdmin
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
  const { data, error } = await supabaseAdmin
    .from("secrets")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function createSecret(
  secret: Database["public"]["Tables"]["secrets"]["Insert"],
) {
  "use server";
  const { data, error } = await supabaseAdmin
    .from("secrets")
    .insert([secret])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSecret(
  id: string,
  secret: Partial<Database["public"]["Tables"]["secrets"]["Update"]>,
) {
  "use server";
  const { data, error } = await supabaseAdmin
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
  const { error } = await supabaseAdmin.from("secrets").delete().eq("id", id);

  if (error) throw error;
}

export async function getOverdueSecrets() {
  "use server";
  const { data, error } = await supabaseAdmin
    .from("secrets")
    .select("*")
    .eq("status", "active")
    .lt("next_check_in", new Date().toISOString());

  if (error) throw error;
  return data;
}
