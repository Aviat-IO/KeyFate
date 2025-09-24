import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL ||
    "postgresql://postgres:dev_password_change_in_prod@localhost:5432/keyfate_dev";

  console.log("Running database migrations...");

  // Check if we should reset the database first
  const shouldReset = process.argv.includes('--reset');
  if (shouldReset) {
    console.log("🔄 Reset flag detected, dropping all tables first...");
  }

  const queryClient = postgres(connectionString, { max: 1 });
  const db = drizzle(queryClient);

  try {
    if (shouldReset) {
      console.log("🗑️  Dropping all tables and types...");
      await queryClient`DROP SCHEMA public CASCADE`;
      await queryClient`CREATE SCHEMA public`;
      await queryClient`GRANT ALL ON SCHEMA public TO postgres`;
      await queryClient`GRANT ALL ON SCHEMA public TO public`;
      console.log("✅ Database reset complete");
    }

    // Use Drizzle's built-in migration runner
    const migrationsFolder = path.join(__dirname, "../drizzle");
    console.log(`📁 Running migrations from: ${migrationsFolder}`);

    await migrate(db, { migrationsFolder });
    console.log("✅ All migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

// Run migrations
runMigrations();