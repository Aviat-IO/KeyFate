import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:dev_password_change_in_prod@localhost:5432/keyfate_dev";

// For migrations and single queries
const migrationClient = postgres(connectionString, { max: 1 });

// For application use
const queryClient = postgres(connectionString);

// Create the drizzle database instance
export const db = drizzle(queryClient, {
  schema,
});

// Export for migrations
export const migrationDb = drizzle(migrationClient, {
  schema,
});

// Export schema for use in other files
export * from "./schema";