// Create seed users with specific UUIDs for development
// Usage: node create-seed-users.js
// Make sure to get your Service Role Key from Supabase Dashboard > Settings > API

const { createClient } = require("@supabase/supabase-js")

// Local Supabase configuration
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error(
    "❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required",
  )
  console.log(
    "💡 Get it from: Supabase Dashboard > Settings > API > service_role key",
  )
  console.log(
    "💡 Then run: SUPABASE_SERVICE_ROLE_KEY=your_key_here node create-seed-users.js",
  )
  console.log(
    "💡 Or use direnv: create .envrc with 'export SUPABASE_SERVICE_ROLE_KEY=your_key_here'",
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// These UUIDs match the seeded database records
const users = [
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

  // Test connection first
  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    })
    if (error) {
      console.error("❌ Failed to connect to Supabase Auth:", error.message)
      process.exit(1)
    }
    console.log("✅ Connected to Supabase Auth successfully")
  } catch (err) {
    console.error("❌ Connection test failed:", err.message)
    process.exit(1)
  }

  for (const user of users) {
    try {
      console.log(`Creating user: ${user.email}...`)

      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        id: user.id, // Changed from user_id to id
        email_confirm: true,
        user_metadata: {
          name: user.name,
        },
      })

      if (error) {
        if (
          error.message.includes("already registered") ||
          error.message.includes("already exists")
        ) {
          console.log(`✅ User ${user.email} already exists (${user.id})`)
        } else {
          console.error(`❌ Error creating ${user.email}:`, error.message)
          console.error("Full error details:", error)
        }
      } else {
        console.log(`✅ Created: ${user.email} (${user.id})`)
        if (data.user) {
          console.log(
            `   📧 Email confirmed: ${data.user.email_confirmed_at ? "Yes" : "No"}`,
          )
        }
      }
    } catch (err) {
      console.error(`❌ Failed to create ${user.email}:`, err.message)
      console.error("Stack trace:", err.stack)
    }

    // Small delay between user creations
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log("\n🎉 Seed users setup complete!")
  console.log("\n📧 You can now login with any of these accounts:")
  users.forEach((user) => {
    console.log(`   ${user.email} / password123`)
  })

  console.log("\n💡 Special features for ceo@aviat.io:")
  console.log("   🔴 1 secret already triggered (2 days ago)")
  console.log("   🟡 1 secret triggering in 5 minutes")
  console.log("   🟢 1 secret triggering in 30 days")
}

createUsers().catch(console.error)
