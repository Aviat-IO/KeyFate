import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || "deadman",
  password: process.env.POSTGRES_PASSWORD || "deadmanpass",
  database: process.env.POSTGRES_DB || "deadman_switch",
});

export const db = drizzle(pool, { schema });
