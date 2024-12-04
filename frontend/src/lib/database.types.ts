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
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          recipient_name: string;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          contact_method: "email" | "phone" | "both";
          check_in_days?: number;
          last_check_in?: string | null;
          next_check_in?: string | null;
          status?: "active" | "paused" | "triggered";
          is_triggered?: boolean | null;
          triggered_at?: string | null;
          iv: string;
          auth_tag: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          recipient_name?: string;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          contact_method?: "email" | "phone" | "both";
          check_in_days?: number;
          last_check_in?: string | null;
          next_check_in?: string | null;
          status?: "active" | "paused" | "triggered";
          is_triggered?: boolean | null;
          triggered_at?: string | null;
          iv?: string;
          auth_tag?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_contact_methods: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          phone: string | null;
          telegram_username: string | null;
          whatsapp: string | null;
          signal: string | null;
          preferred_method: "email" | "phone" | "both";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email?: string | null;
          phone?: string | null;
          telegram_username?: string | null;
          whatsapp?: string | null;
          signal?: string | null;
          preferred_method?: "email" | "phone" | "both";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string | null;
          phone?: string | null;
          telegram_username?: string | null;
          whatsapp?: string | null;
          signal?: string | null;
          preferred_method?: "email" | "phone" | "both";
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      contact_method: "email" | "phone" | "both";
      secret_status: "active" | "paused" | "triggered";
    };
  };
}
