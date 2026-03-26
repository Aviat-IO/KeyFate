/**
 * MIGRATION NOTICE: This file has been migrated to Drizzle ORM
 *
 * Use types from:
 * - @/types/index.d.ts for current Drizzle-based types
 * - @/lib/db/schema for table definitions
 *
 * This file redirects to new types for backward compatibility.
 * For new code, import directly from @/types/index.d.ts
 */

// Re-export types from the new Drizzle-based system
export type {
  Secret,
  SecretInsert,
  SecretUpdate,
  User,
  UserInsert,
  UserUpdate,
  Database,
  Tables,
  Reminder,
  ReminderInsert,
  ReminderUpdate
} from "$lib/types/index.d.ts";

// Legacy JSON type for compatibility
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Legacy exports for backward compatibility
export type { Tables as TablesInsert } from "$lib/types/index.d.ts";
export type { Tables as TablesUpdate } from "$lib/types/index.d.ts";

// Legacy enums (use schema enums instead)
export type Enums<T> = T extends "contact_method"
  ? "email" | "phone" | "both"
  : T extends "secret_status"
  ? "active" | "paused" | "triggered"
  : T extends "subscription_tier"
  ? "free" | "pro"
  : never;

export type CompositeTypes<_T = never> = never;