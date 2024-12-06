-- Enable RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for reminders table
CREATE POLICY "Users can view their own reminders"
  ON reminders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all reminders"
  ON reminders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policies for admin_notifications table
CREATE POLICY "Only super admins can view notifications"
  ON admin_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.is_super_admin = true
    )
  );

CREATE POLICY "Only super admins can acknowledge notifications"
  ON admin_notifications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.is_super_admin = true
    )
  );

CREATE POLICY "Service role can manage all notifications"
  ON admin_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add is_super_admin column to auth.users if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE auth.users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$; 

-- Enable RLS on reminders table
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own reminders
CREATE POLICY "Users can view their own reminders"
ON reminders FOR SELECT
USING (auth.uid() = user_id);

-- Allow the security definer functions to manage reminders
ALTER FUNCTION schedule_secret_reminders(UUID, TIMESTAMPTZ) SECURITY DEFINER;
ALTER FUNCTION handle_failed_reminder(UUID, TEXT) SECURITY DEFINER;
ALTER FUNCTION schedule_reminders_on_secret_change() SECURITY DEFINER;

-- Allow the functions to bypass RLS
ALTER FUNCTION schedule_secret_reminders(UUID, TIMESTAMPTZ) SET search_path = public;
ALTER FUNCTION handle_failed_reminder(UUID, TEXT) SET search_path = public;
ALTER FUNCTION schedule_reminders_on_secret_change() SET search_path = public;

-- Allow the process-reminders cron job to read and update reminders
CREATE POLICY "Allow service role to manage reminders"
ON reminders
FOR ALL
USING (true)
WITH CHECK (true);

-- Allow users to update their own reminders (for manual cancellation if needed)
CREATE POLICY "Users can update their own reminders"
ON reminders FOR UPDATE
USING (auth.uid() = user_id);
