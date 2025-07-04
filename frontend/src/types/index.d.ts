import * as supabase from "../../../supabase/types";

export * from "../../../supabase/types";

export type Database = supabase.Database;
export type Tables<T extends keyof supabase.Database["public"]["Tables"]> =
  supabase.Database["public"]["Tables"][T]["Row"];

export type Secret = supabase.Secret;
export type Reminder = supabase.Reminder;
export type SecretUpdate = supabase.SecretUpdate;
export type ReminderUpdate = supabase.ReminderUpdate;
export type SecretInsert = supabase.SecretInsert;
export type ReminderInsert = supabase.ReminderInsert;
