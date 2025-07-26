import { Database } from "./database.types.ts";

// export Database = SupabaseDatabase;

export type Secret = Database["public"]["Tables"]["secrets"]["Row"];
export type SecretUpdate = Database["public"]["Tables"]["secrets"]["Update"];
export type SecretInsert = Database["public"]["Tables"]["secrets"]["Insert"];

export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];
export type ReminderUpdate =
  Database["public"]["Tables"]["reminders"]["Update"];
export type ReminderInsert =
  Database["public"]["Tables"]["reminders"]["Insert"];
