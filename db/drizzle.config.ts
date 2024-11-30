import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || "deadman",
    password: process.env.POSTGRES_PASSWORD || "deadmanpass",
    database: process.env.POSTGRES_DB || "deadman_switch",
  },
} satisfies Config;
