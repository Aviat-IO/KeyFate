# Environment Setup for Dynamic Cron Jobs

The cron jobs are now environment-agnostic and use a configuration table. This eliminates the need for multiple environment-specific migration files, avoids permission issues, and keeps sensitive tokens out of version control.

## Configuration Table Approach

The migration creates a `cron_config` table to store environment-specific settings. This approach works in all Supabase environments without requiring superuser privileges.

## Required Configuration

For each Supabase environment (local, staging, production), you need to configure:

### 1. `project_url`

The base URL for your Supabase instance.

**Examples:**

- **Local**: `http://127.0.0.1:54321`
- **Staging**: `https://[your-staging-project-id].supabase.co`
- **Production**: `https://[your-production-project-id].supabase.co`

### 2. `service_role_key`

The service role key for your Supabase project.

⚠️ **Important**: Use the **service role key**, not the anon key, as cron jobs need elevated permissions.

## Setting Up Configuration

### For All Environments

Run this SQL in your Supabase Studio SQL Editor after applying the migrations:

```sql
-- Insert or update cron configuration
INSERT INTO cron_config (id, project_url, service_role_key)
VALUES (
  1,
  'https://[your-project-id].supabase.co',  -- Replace with your project URL
  '[your-service-role-key]'                  -- Replace with your service role key
)
ON CONFLICT (id)
DO UPDATE SET
  project_url = EXCLUDED.project_url,
  service_role_key = EXCLUDED.service_role_key,
  updated_at = CURRENT_TIMESTAMP;
```

### Local Development Example

```sql
-- Local development configuration
INSERT INTO cron_config (id, project_url, service_role_key)
VALUES (
  1,
  'http://127.0.0.1:54321',
  '[your-service-role-key]'                  -- Replace with your service role key
)
ON CONFLICT (id)
DO UPDATE SET
  project_url = EXCLUDED.project_url,
  service_role_key = EXCLUDED.service_role_key,
  updated_at = CURRENT_TIMESTAMP;
```

### Finding Your Service Role Key

1. Go to your project in Supabase Dashboard
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (not the anon key)

## Verification

After configuring, you can verify it's working:

```sql
-- Check current configuration
SELECT * FROM get_cron_config();

-- Check the configuration table
SELECT id, project_url, created_at, updated_at FROM cron_config;

-- Check scheduled cron jobs
SELECT * FROM cron.job;
```

## Security Benefits

✅ **No secrets in version control**
✅ **Environment-specific configuration via table**
✅ **Single migration file to maintain**
✅ **Works without superuser privileges**
✅ **Graceful failure** - skips cron setup if not configured
✅ **RLS protection** - only service role can modify config

## Troubleshooting

### Cron jobs not running?

1. Check if configuration exists: `SELECT * FROM cron_config;`
2. Verify the service role key is correct
3. Ensure the project URL is accessible from your Supabase instance
4. Check cron job logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC;`

### Configuration not found?

If you see "No cron configuration found" in the logs:

```sql
-- Insert configuration for your environment
INSERT INTO cron_config (id, project_url, service_role_key)
VALUES (1, 'your-project-url', 'your-service-role-key');
```

### Permission issues?

The `cron_config` table is protected by RLS. If you need to modify it manually, use a connection with service role privileges or check via the Supabase Dashboard → SQL Editor.

## Migration Process

When switching between environments:

1. **Apply the migration** → Creates `cron_config` table
2. **Insert configuration** → Enables cron jobs for that environment
3. **Verify** → Check that cron jobs are scheduled

This approach ensures each environment has its own configuration without hardcoded secrets!
