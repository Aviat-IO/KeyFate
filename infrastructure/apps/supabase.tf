# Supabase Configuration
# This module configures the cron_config table in Supabase for dynamic cron jobs

locals {
  # Extract the project URL from the public Supabase URL
  # Convert https://project-id.supabase.co to just https://project-id.supabase.co
  supabase_project_url = var.next_public_supabase_url

  # SQL command to configure cron jobs (idempotent with ON CONFLICT)
  cron_config_sql = <<-EOT
    INSERT INTO cron_config (id, project_url, service_role_key)
    VALUES (
      1,
      '${local.supabase_project_url}',
      '${var.supabase_service_role_key}'
    )
    ON CONFLICT (id)
    DO UPDATE SET
      project_url = EXCLUDED.project_url,
      service_role_key = EXCLUDED.service_role_key,
      updated_at = CURRENT_TIMESTAMP;
  EOT
}

# Configure Supabase cron settings
resource "null_resource" "configure_supabase_cron" {
  # Trigger when configuration changes
  triggers = {
    project_url      = local.supabase_project_url
    service_role_key = sha256(var.supabase_service_role_key) # Hash for security
    env              = var.env
    sql_hash         = sha256(local.cron_config_sql)
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo "Configuring Supabase cron settings for ${var.env} environment..."

      # Create temporary SQL file
      SQL_FILE=$(mktemp /tmp/supabase_cron_config.XXXXXX.sql)
      cat > "$SQL_FILE" << 'EOF'
${local.cron_config_sql}
EOF

      # Execute SQL using psql with the database connection
      if command -v psql >/dev/null 2>&1; then
        echo "Executing SQL via psql..."
        psql "${var.db_url}" -f "$SQL_FILE"
      elif command -v supabase >/dev/null 2>&1; then
        echo "Executing SQL via Supabase CLI..."
        # Alternative: use Supabase CLI if available
        supabase db sql --db-url "${var.db_url}" < "$SQL_FILE"
      else
        echo "Error: Neither psql nor supabase CLI is available"
        echo "Please install postgresql-client or supabase CLI"
        exit 1
      fi

      # Clean up
      rm -f "$SQL_FILE"

      echo "Supabase cron configuration completed successfully!"
    EOT

    environment = {
      PGPASSWORD = "" # Password is included in the connection string
    }
  }

  # Only run after the database migrations are applied
  depends_on = [
    module.frontend_secrets # Ensure secrets are available
  ]
}

# Verification resource to check cron configuration
resource "null_resource" "verify_supabase_cron" {
  # Run after configuration
  depends_on = [null_resource.configure_supabase_cron]

  provisioner "local-exec" {
    command = <<-EOT
      echo "Verifying Supabase cron configuration..."

      # Create verification SQL
      VERIFY_SQL=$(mktemp /tmp/verify_cron.XXXXXX.sql)
      cat > "$VERIFY_SQL" << 'EOF'
-- Check cron configuration
SELECT
  'Cron Config' as check_type,
  id,
  project_url,
  CASE
    WHEN service_role_key IS NOT NULL THEN 'Configured'
    ELSE 'Missing'
  END as service_key_status,
  created_at,
  updated_at
FROM cron_config
WHERE id = 1;

-- Check scheduled cron jobs
SELECT
  'Cron Jobs' as check_type,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname IN ('check-secrets', 'process-reminders');
EOF

      # Execute verification
      if command -v psql >/dev/null 2>&1; then
        psql "${var.db_url}" -f "$VERIFY_SQL"
      elif command -v supabase >/dev/null 2>&1; then
        supabase db sql --db-url "${var.db_url}" < "$VERIFY_SQL"
      fi

      rm -f "$VERIFY_SQL"
    EOT

    environment = {
      PGPASSWORD = ""
    }
  }
}
