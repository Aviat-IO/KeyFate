-- Database Permissions Setup for KeyFate Cloud SQL
-- Run this script after creating users and database

-- Connect to the keyfate database first
\c keyfate;

-- Create roles for different access levels
CREATE ROLE app_role;
CREATE ROLE backup_role;
CREATE ROLE readonly_role;

-- Grant appropriate permissions to app_role (for keyfate_app user)
GRANT CONNECT ON DATABASE keyfate TO app_role;
GRANT USAGE ON SCHEMA public TO app_role;
GRANT CREATE ON SCHEMA public TO app_role;

-- Grant table permissions for application operations
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_role;

-- Grant backup permissions (for keyfate_backup user)
GRANT CONNECT ON DATABASE keyfate TO backup_role;
GRANT USAGE ON SCHEMA public TO backup_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_role;

-- Grant read-only permissions (for keyfate_readonly user)
GRANT CONNECT ON DATABASE keyfate TO readonly_role;
GRANT USAGE ON SCHEMA public TO readonly_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_role;

-- Assign roles to users
GRANT app_role TO keyfate_app;
GRANT backup_role TO keyfate_backup;
GRANT readonly_role TO keyfate_readonly;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_secrets_user_id ON secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_secrets_status ON secrets(status);
CREATE INDEX IF NOT EXISTS idx_secrets_next_check_in ON secrets(next_check_in);
CREATE INDEX IF NOT EXISTS idx_check_in_tokens_secret_id ON check_in_tokens(secret_id);
CREATE INDEX IF NOT EXISTS idx_check_in_tokens_token ON check_in_tokens(token);
CREATE INDEX IF NOT EXISTS idx_checkin_history_secret_id ON checkin_history(secret_id);
CREATE INDEX IF NOT EXISTS idx_checkin_history_user_id ON checkin_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);

-- Security: Revoke public permissions
REVOKE ALL ON SCHEMA public FROM public;
REVOKE ALL ON DATABASE keyfate FROM public;

-- Enable row level security on sensitive tables
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic user isolation)
-- Users can only access their own data
CREATE POLICY secrets_user_policy ON secrets FOR ALL USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY checkin_history_user_policy ON checkin_history FOR ALL USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY user_contact_methods_user_policy ON user_contact_methods FOR ALL USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY user_subscriptions_user_policy ON user_subscriptions FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- Allow app_role to bypass RLS for administrative operations
ALTER TABLE secrets FORCE ROW LEVEL SECURITY;
ALTER TABLE checkin_history FORCE ROW LEVEL SECURITY;
ALTER TABLE user_contact_methods FORCE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions FORCE ROW LEVEL SECURITY;

-- Create function to set user context
CREATE OR REPLACE FUNCTION set_current_user_id(user_id TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION set_current_user_id(TEXT) TO app_role;

-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, display_name, max_secrets, max_recipients_per_secret, custom_intervals, price_monthly, price_yearly) VALUES
('free', 'Free Tier', 3, 1, false, NULL, NULL),
('basic', 'Basic Plan', 10, 3, false, 9.99, 99.99),
('premium', 'Premium Plan', 50, 10, true, 19.99, 199.99),
('enterprise', 'Enterprise Plan', 1000, 100, true, 99.99, 999.99)
ON CONFLICT (name) DO NOTHING;

COMMIT;