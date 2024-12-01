export type Secret = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  contact_method: "email" | "phone" | "both";
  check_in_interval: string;
  last_check_in: string | null;
  next_check_in: string | null;
  status: "active" | "paused" | "triggered";
  created_at: string;
  updated_at: string;
  is_triggered: boolean;
  triggered_at: string | null;
  is_active: boolean;
};
