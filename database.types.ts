export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          message: string
          metadata: Json | null
          severity: string
          title: string
          type: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          severity: string
          title: string
          type: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          severity?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "subscription_management"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_notifications_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "user_tier_info"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_notifications_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "user_usage_info"
            referencedColumns: ["user_id"]
          },
        ]
      }
      check_in_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          secret_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          secret_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          secret_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_in_tokens_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_history: {
        Row: {
          checked_in_at: string
          created_at: string
          id: string
          next_check_in: string
          secret_id: string
          user_id: string
        }
        Insert: {
          checked_in_at: string
          created_at?: string
          id?: string
          next_check_in: string
          secret_id: string
          user_id: string
        }
        Update: {
          checked_in_at?: string
          created_at?: string
          id?: string
          next_check_in?: string
          secret_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_history_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "secrets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_management"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "checkin_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_tier_info"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "checkin_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_info"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cron_config: {
        Row: {
          created_at: string
          id: number
          project_url: string
          service_role_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          project_url?: string
          service_role_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          project_url?: string
          service_role_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recipient_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          secret_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          secret_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          secret_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipient_access_tokens_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          error: string | null
          id: string
          last_retry_at: string | null
          retry_count: number
          scheduled_for: string
          secret_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
          type: Database["public"]["Enums"]["reminder_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          last_retry_at?: string | null
          retry_count?: number
          scheduled_for: string
          secret_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          type: Database["public"]["Enums"]["reminder_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          last_retry_at?: string | null
          retry_count?: number
          scheduled_for?: string
          secret_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          type?: Database["public"]["Enums"]["reminder_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "secrets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_management"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_tier_info"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_info"
            referencedColumns: ["user_id"]
          },
        ]
      }
      secrets: {
        Row: {
          auth_tag: string | null
          check_in_days: number
          contact_method: Database["public"]["Enums"]["contact_method"]
          created_at: string
          id: string
          is_triggered: boolean | null
          iv: string | null
          last_check_in: string | null
          next_check_in: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          server_share: string | null
          sss_shares_total: number
          sss_threshold: number
          status: Database["public"]["Enums"]["secret_status"]
          title: string
          triggered_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_tag?: string | null
          check_in_days?: number
          contact_method: Database["public"]["Enums"]["contact_method"]
          created_at?: string
          id?: string
          is_triggered?: boolean | null
          iv?: string | null
          last_check_in?: string | null
          next_check_in?: string | null
          recipient_email?: string | null
          recipient_name: string
          recipient_phone?: string | null
          server_share?: string | null
          sss_shares_total?: number
          sss_threshold?: number
          status?: Database["public"]["Enums"]["secret_status"]
          title: string
          triggered_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_tag?: string | null
          check_in_days?: number
          contact_method?: Database["public"]["Enums"]["contact_method"]
          created_at?: string
          id?: string
          is_triggered?: boolean | null
          iv?: string | null
          last_check_in?: string | null
          next_check_in?: string | null
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          server_share?: string | null
          sss_shares_total?: number
          sss_threshold?: number
          status?: Database["public"]["Enums"]["secret_status"]
          title?: string
          triggered_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secrets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_management"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "secrets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_tier_info"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "secrets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_info"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tiers: {
        Row: {
          created_at: string
          custom_intervals: boolean
          display_name: string
          id: string
          max_recipients_per_secret: number
          max_secrets: number
          name: Database["public"]["Enums"]["subscription_tier"]
          price_monthly: number | null
          price_yearly: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_intervals?: boolean
          display_name: string
          id?: string
          max_recipients_per_secret: number
          max_secrets: number
          name: Database["public"]["Enums"]["subscription_tier"]
          price_monthly?: number | null
          price_yearly?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_intervals?: boolean
          display_name?: string
          id?: string
          max_recipients_per_secret?: number
          max_secrets?: number
          name?: Database["public"]["Enums"]["subscription_tier"]
          price_monthly?: number | null
          price_yearly?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_contact_methods: {
        Row: {
          created_at: string
          email: string | null
          id: string
          phone: string | null
          preferred_method: Database["public"]["Enums"]["contact_method"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          preferred_method?: Database["public"]["Enums"]["contact_method"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          preferred_method?: Database["public"]["Enums"]["contact_method"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contact_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_management"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_contact_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_tier_info"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_contact_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_info"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier_name: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier_name?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier_name?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "subscription_management"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_tier_info"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_usage_info"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_tiers: {
        Row: {
          created_at: string
          id: string
          tier_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tier_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tier_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tiers_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tiers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "subscription_management"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_tiers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_tier_info"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_tiers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_usage_info"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      subscription_management: {
        Row: {
          cancel_at_period_end: boolean | null
          current_period_end: string | null
          current_period_start: string | null
          current_secrets_count: number | null
          current_total_recipients: number | null
          email: string | null
          max_recipients_per_secret: number | null
          max_secrets: number | null
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          tier_display_name: string | null
          tier_name: Database["public"]["Enums"]["subscription_tier"] | null
          user_id: string | null
        }
        Relationships: []
      }
      user_tier_info: {
        Row: {
          cancel_at_period_end: boolean | null
          current_period_end: string | null
          current_period_start: string | null
          custom_intervals: boolean | null
          email: string | null
          max_recipients_per_secret: number | null
          max_secrets: number | null
          price_monthly: number | null
          price_yearly: number | null
          provider: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          tier_display_name: string | null
          tier_name: Database["public"]["Enums"]["subscription_tier"] | null
          user_id: string | null
        }
        Relationships: []
      }
      user_usage_info: {
        Row: {
          can_create_secret: boolean | null
          current_secrets_count: number | null
          current_total_recipients: number | null
          email: string | null
          max_recipients_per_secret: number | null
          max_secrets: number | null
          tier_name: Database["public"]["Enums"]["subscription_tier"] | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_user_tier: {
        Args: {
          p_tier_name: Database["public"]["Enums"]["subscription_tier"]
          p_user_id: string
        }
        Returns: boolean
      }
      calculate_user_usage: {
        Args: { p_user_id: string }
        Returns: {
          secrets_count: number
          total_recipients: number
        }[]
      }
      can_create_secret: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      check_in_secret: {
        Args: {
          p_checked_in_at: string
          p_next_check_in: string
          p_secret_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_check_in_token: {
        Args: { p_expires_in?: unknown; p_secret_id: string }
        Returns: string
      }
      get_cron_config: {
        Args: Record<PropertyKey, never>
        Returns: {
          base_url: string
          auth_header: string
        }[]
      }
      get_tier_by_name: {
        Args: { p_tier_name: Database["public"]["Enums"]["subscription_tier"] }
        Returns: {
          price_monthly: number
          price_yearly: number
          custom_intervals: boolean
          id: string
          name: Database["public"]["Enums"]["subscription_tier"]
          display_name: string
          max_secrets: number
          max_recipients_per_secret: number
        }[]
      }
      get_user_tier: {
        Args: { p_user_id: string }
        Returns: {
          max_secrets: number
          tier_name: Database["public"]["Enums"]["subscription_tier"]
          max_recipients_per_secret: number
          custom_intervals: boolean
          subscription_status: Database["public"]["Enums"]["subscription_status"]
        }[]
      }
      handle_failed_reminder: {
        Args: { p_error: string; p_reminder_id: string }
        Returns: undefined
      }
      initialize_free_tiers: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      migrate_user_subscription_provider: {
        Args: {
          p_provider: string
          p_provider_customer_id?: string
          p_provider_subscription_id?: string
          p_user_id: string
        }
        Returns: boolean
      }
      schedule_secret_reminders: {
        Args: { p_next_check_in: string; p_secret_id: string }
        Returns: undefined
      }
      toggle_secret_pause: {
        Args: {
          p_checked_in_at: string
          p_new_status: string
          p_next_check_in: string
          p_secret_id: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      contact_method: "email" | "phone" | "both"
      reminder_status: "pending" | "sent" | "failed" | "cancelled"
      reminder_type:
        | "25_percent"
        | "50_percent"
        | "7_days"
        | "3_days"
        | "24_hours"
        | "12_hours"
        | "1_hour"
      secret_status: "active" | "paused" | "triggered"
      subscription_status:
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "trialing"
        | "paused"
      subscription_tier: "free" | "pro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      contact_method: ["email", "phone", "both"],
      reminder_status: ["pending", "sent", "failed", "cancelled"],
      reminder_type: [
        "25_percent",
        "50_percent",
        "7_days",
        "3_days",
        "24_hours",
        "12_hours",
        "1_hour",
      ],
      secret_status: ["active", "paused", "triggered"],
      subscription_status: [
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "trialing",
        "paused",
      ],
      subscription_tier: ["free", "pro"],
    },
  },
} as const

