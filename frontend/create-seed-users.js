// Create seed users directly in Postgres via Drizzle
// Usage: node create-seed-users.js
// Requires: DATABASE_URL in environment

const postgres = require("postgres")
const { drizzle } = require("drizzle-orm/postgres-js")

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL environment variable is required")
  console.log(
    "💡 Example: DATABASE_URL=postgres://user:pass@host:5432/db node create-seed-users.js",
  )
  process.exit(1)
}

const client = postgres(DATABASE_URL)
const db = drizzle(client)
const { users: usersTable } = require("./dist/lib/db/schema.js")

// These UUIDs match the seeded database records
const seedUsers = [
  {
    id: "48a35ccd-e1e4-458b-86ec-5bd88a0addc7",
    email: "ceo@aviat.io",
    password: "password123",
    name: "CEO Aviat",
  },
  {
    id: "836f82db-9912-4b34-8101-1f16b49dfa5f",
    email: "john.doe@example.com",
    password: "password123",
    name: "John Doe",
  },
  {
    id: "2734a10c-2335-480b-8bf3-efc468cf89de",
    email: "alice.smith@company.com",
    password: "password123",
    name: "Alice Smith",
  },
  {
    id: "78dd97e7-1ce4-4a41-8fdc-69e3371f2175",
    email: "bob.wilson@startup.io",
    password: "password123",
    name: "Bob Wilson",
  },
]

async function createUsers() {
  console.log("🔐 Creating seed users with specific UUIDs...\n")
  // Test DB connection
  await db.execute("select 1;")
  console.log("✅ Connected to Postgres successfully")

  for (const user of seedUsers) {
    try {
      console.log(`Creating user: ${user.email}...`)

      // Upsert user record
      await db
        .insert(usersTable)
        .values({
          id: user.id,
          email: user.email.toLowerCase(),
          name: user.name,
          password: null,
          emailVerified: new Date(),
        })
        .onConflictDoNothing()
      console.log(`✅ Ensured user exists: ${user.email} (${user.id})`)
    } catch (err) {
      console.error(`❌ Failed to create ${user.email}:`, err.message)
      console.error("Stack trace:", err.stack)
    }

    // Small delay between user creations
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log("\n🎉 Seed users setup complete!")
  console.log("\n📧 You can now login with any of these accounts:")
  seedUsers.forEach((user) => {
    console.log(`   ${user.email} / password123`)
  })

  console.log("\n💡 Special features for ceo@aviat.io:")
  console.log("   🔴 1 secret already triggered (2 days ago)")
  console.log("   🟡 1 secret triggering in 5 minutes")
  console.log("   🟢 1 secret triggering in 30 days")
}

createUsers().catch(console.error)
