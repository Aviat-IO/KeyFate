# KeyFate Database Seed Data

This seed file provides comprehensive test data for local development of the KeyFate dead man's switch platform.

## 🔧 Prerequisites

For **Option B** (full seed), you'll need:

- **Service Role Key** from Supabase Dashboard > Settings > API
- **direnv** (optional but recommended): `brew install direnv` or see [direnv.net](https://direnv.net/)

## 🔧 How to Use

### Option A: Quick Setup (New Users)

**Best for quick testing without complex setup:**

1. **Reset database:** `cd supabase && supabase db reset`
2. **Start frontend:** `cd frontend && pnpm dev`
3. **Sign up any test users** via your app's signup page
4. **Create secrets manually** through the app interface

✅ **Pros:** Simple, no configuration needed
⚠️ **Cons:** No pre-seeded secrets with special timing scenarios

### Option B: Full Seed with Matching UUIDs

**Best for complete testing with all pre-seeded data:**

1. **Get Service Role Key:** Supabase Dashboard > Settings > API > `service_role` key
2. **Setup and run:**

   **Option 2a: Using Makefile (easiest)**

   ```bash
   # Setup environment variable with direnv
   cp .envrc.example .envrc
   # Edit .envrc with your actual service role key
   direnv allow

   # One command does everything!
   cd supabase && make reset-and-seed
   ```

   **Option 2b: Manual steps**

   ```bash
   cd supabase && make seed-db
   SUPABASE_SERVICE_ROLE_KEY=your_key_here make seed-users
   ```

   **Option 2c: Direct script execution**

   ```bash
   cd supabase && supabase db reset
   cd frontend && SUPABASE_SERVICE_ROLE_KEY=your_key_here node create-seed-users.js
   ```

✅ **Pros:** Complete seed data with special timing scenarios
⚠️ **Cons:** Requires Service Role Key setup

## 👥 Test Users

| Email | Password | Tier | Secrets | Special Features |
|-------|----------|------|---------|------------------|
| <ceo@aviat.io> | password123 | Pro | 3 | ⏰ Special timing scenarios |
| <john.doe@example.com> | password123 | Free | 1 | 🆓 Free tier limits |
| <alice.smith@company.com> | password123 | Pro | 4 | 📧📱 Email + Phone contact |
| <bob.wilson@startup.io> | password123 | Pro | 2 | 📱 Phone-only contact |

## ⏰ CEO Special Timing Scenarios

The `ceo@aviat.io` user has secrets designed to test different trigger scenarios:

1. **Bitcoin Wallet Recovery** - 🔴 **Already triggered** (2 days ago)
2. **Buried Gold Location** - 🟡 **Reminder ready in 30 seconds** (triggers in 5 minutes)
3. **Safe Combination** - 🟢 **Triggering in 30 days**

## 🗂️ Sample Secret Types

The seed includes various realistic secret types:

- 🪙 Bitcoin wallet seed phrases
- 🗺️ Buried treasure coordinates
- 🔐 Safe combinations
- 🏦 Bank account details
- 💻 Server access credentials
- 📋 Personal document locations

## 📊 Data Overview

- **4 users** (1 free, 3 pro tier)
- **10 secrets** with encrypted server shares
- **Multiple check-in history** entries per user
- **Reminder schedules** for active secrets
- **Contact method variety** (email, phone, both)
- **Admin notifications** for testing
- **Subscription data** with Paddle integration

## 🔐 Security Features

- All server shares use **AES-256-GCM encryption**
- Secrets implement **Shamir's Secret Sharing** (2-of-3 threshold)
- **Check-in tokens** for secure access
- **Recipient access tokens** for triggered secrets

## 🧪 Testing Scenarios

This seed data enables testing:

- ✅ Different subscription tiers and limits
- ✅ Secret triggering and expiration flows
- ✅ Contact method preferences (email/phone/both)
- ✅ Check-in reminder systems
- ✅ Admin notification workflows
- ✅ Secret sharing and recovery processes

### Testing Reminder System

To test the reminder processing system:

1. **Seed the database:** `cd supabase && make reset-and-seed`
2. **Start reminder processor:** `cd scripts && ./trigger-reminders.sh`
3. **Wait 30-60 seconds** - The "Buried Gold Location" secret for CEO will have a reminder ready to process
4. **Check logs** - You should see reminder processing activity in the script output

## 🔄 Refreshing Data

To refresh the seed data:

**Using Makefile (recommended):**
```bash
cd supabase && make reset-and-seed
```

**Manual approach:**
```bash
cd supabase && supabase db reset
# Then recreate auth users via create-seed-users.js or dashboard
```

## 🛠️ Makefile Commands

For convenience, use these Makefile commands in the `supabase/` directory:

| Command | Description |
|---------|-------------|
| `make seed-db` | Reset database and apply seed.sql |
| `make seed-users` | Create auth users with specific UUIDs |
| `make reset-and-seed` | Complete setup: users first, then database reset |
| `make verify-seed` | Check that secrets are properly linked to users |
| `make apply-seed-data` | Re-apply seed.sql to existing database |

## 🔍 Troubleshooting

### No secrets showing in dashboard after login?

1. **Verify the seed data:**
   ```bash
   cd supabase && make verify-seed
   ```

2. **Check if secrets exist but aren't linked:**
   - Look for "Secrets Count by User" in the output
   - If count is 0 but "All Secrets in Database" shows data, there's a linking issue

3. **Re-run the complete setup:**
   ```bash
   cd supabase && make reset-and-seed
   ```

### Common Issues:
- **Foreign key constraint violations:** Auth users must exist before database records
- **RLS policies:** May prevent viewing secrets created before auth users existed
- **UUID mismatches:** Use `make verify-seed` to check user IDs match

## ⚠️ Important Notes

- **Development only** - Contains test data with hardcoded values
- **Encryption key** - Uses a fixed key for development consistency
- **Realistic timing** - Some secrets trigger soon for immediate testing
- **Complete coverage** - Tests all major features and edge cases
