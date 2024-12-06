export type Secret = {
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
  created_at: string;
  updated_at: string;
  is_triggered: boolean;
  triggered_at: string | null;
  iv: string;
  auth_tag: string;
};

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
        Row: Secret;
      };
      user_contact_methods: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          phone: string | null;
          preferred_method: "email" | "phone" | "both";
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}
