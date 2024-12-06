export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      secrets: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          recipient_name: string;
          recipient_email: string | null;
          recipient_phone: string | null;
          contact_method: "email" | "phone" | "both";
          check_in_days: number;
          last_check_in: string | null;
          next_check_in: string | null;
          status: "active" | "paused" | "triggered";
          is_triggered: boolean | null;
          triggered_at: string | null;
          iv: string;
          auth_tag: string;
          created_at: string;
          updated_at: string;
        };
      };
      reminders: {
        Row: {
          id: string;
          secret_id: string;
          user_id: string;
          type:
            | "25_percent"
            | "50_percent"
            | "7_days"
            | "3_days"
            | "24_hours"
            | "12_hours"
            | "1_hour";
          sent_at: string;
          scheduled_for: string;
          status: "pending" | "sent" | "failed" | "cancelled";
          error: string | null;
          created_at: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
          last_check_in: string | null;
          is_subscribed: boolean;
          stripe_customer_id: string | null;
        };
      };
    };
  };
}
