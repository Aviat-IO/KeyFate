export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          created_at: string;
          id: string;
          message: string;
          metadata: Json | null;
          severity: string;
          title: string;
          type: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          metadata?: Json | null;
          severity: string;
          title: string;
          type: string;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          metadata?: Json | null;
          severity?: string;
          title?: string;
          type?: string;
        };
        Relationships: [];
      };
      check_in_tokens: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          secret_id: string;
          token: string;
          used_at: string | null;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          secret_id: string;
          token: string;
          used_at?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          secret_id?: string;
          token?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "check_in_tokens_secret_id_fkey";
            columns: ["secret_id"];
            isOneToOne: false;
            referencedRelation: "secrets";
            referencedColumns: ["id"];
          },
        ];
      };
      checkin_history: {
        Row: {
          checked_in_at: string;
          created_at: string;
          id: string;
          next_check_in: string;
          secret_id: string;
          user_id: string;
        };
        Insert: {
          checked_in_at: string;
          created_at?: string;
          id?: string;
          next_check_in: string;
          secret_id: string;
          user_id: string;
        };
        Update: {
          checked_in_at?: string;
          created_at?: string;
          id?: string;
          next_check_in?: string;
          secret_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checkin_history_secret_id_fkey";
            columns: ["secret_id"];
            isOneToOne: false;
            referencedRelation: "secrets";
            referencedColumns: ["id"];
          },
        ];
      };
      recipient_access_tokens: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          secret_id: string;
          token: string;
          used_at: string | null;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          secret_id: string;
          token: string;
          used_at?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          secret_id?: string;
          token?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recipient_access_tokens_secret_id_fkey";
            columns: ["secret_id"];
            isOneToOne: false;
            referencedRelation: "secrets";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          last_retry_at: string | null;
          retry_count: number;
          scheduled_for: string;
          secret_id: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["reminder_status"];
          type: Database["public"]["Enums"]["reminder_type"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          last_retry_at?: string | null;
          retry_count?: number;
          scheduled_for: string;
          secret_id: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["reminder_status"];
          type: Database["public"]["Enums"]["reminder_type"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          last_retry_at?: string | null;
          retry_count?: number;
          scheduled_for?: string;
          secret_id?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["reminder_status"];
          type?: Database["public"]["Enums"]["reminder_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_secret_id_fkey";
            columns: ["secret_id"];
            isOneToOne: false;
            referencedRelation: "secrets";
            referencedColumns: ["id"];
          },
        ];
      };
      secrets: {
        Row: {
          auth_tag: string | null;
          check_in_days: number;
          contact_method: Database["public"]["Enums"]["contact_method"];
          created_at: string;
          id: string;
          is_triggered: boolean | null;
          iv: string | null;
          last_check_in: string | null;
          next_check_in: string | null;
          recipient_email: string | null;
          recipient_name: string;
          recipient_phone: string | null;
          server_share: string | null;
          sss_shares_total: number;
          sss_threshold: number;
          status: Database["public"]["Enums"]["secret_status"];
          title: string;
          triggered_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auth_tag?: string | null;
          check_in_days?: number;
          contact_method: Database["public"]["Enums"]["contact_method"];
          created_at?: string;
          id?: string;
          is_triggered?: boolean | null;
          iv?: string | null;
          last_check_in?: string | null;
          next_check_in?: string | null;
          recipient_email?: string | null;
          recipient_name: string;
          recipient_phone?: string | null;
          server_share?: string | null;
          sss_shares_total?: number;
          sss_threshold?: number;
          status?: Database["public"]["Enums"]["secret_status"];
          title: string;
          triggered_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auth_tag?: string | null;
          check_in_days?: number;
          contact_method?: Database["public"]["Enums"]["contact_method"];
          created_at?: string;
          id?: string;
          is_triggered?: boolean | null;
          iv?: string | null;
          last_check_in?: string | null;
          next_check_in?: string | null;
          recipient_email?: string | null;
          recipient_name?: string;
          recipient_phone?: string | null;
          server_share?: string | null;
          sss_shares_total?: number;
          sss_threshold?: number;
          status?: Database["public"]["Enums"]["secret_status"];
          title?: string;
          triggered_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_contact_methods: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          phone: string | null;
          preferred_method: Database["public"]["Enums"]["contact_method"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          phone?: string | null;
          preferred_method?: Database["public"]["Enums"]["contact_method"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          phone?: string | null;
          preferred_method?: Database["public"]["Enums"]["contact_method"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_in_secret: {
        Args: {
          p_secret_id: string;
          p_user_id: string;
          p_checked_in_at: string;
          p_next_check_in: string;
        };
        Returns: undefined;
      };
      create_check_in_token: {
        Args: { p_secret_id: string; p_expires_in?: unknown };
        Returns: string;
      };
      handle_failed_reminder: {
        Args: { p_reminder_id: string; p_error: string };
        Returns: undefined;
      };
      schedule_secret_reminders: {
        Args: { p_secret_id: string; p_next_check_in: string };
        Returns: undefined;
      };
      toggle_secret_pause: {
        Args: {
          p_secret_id: string;
          p_user_id: string;
          p_new_status: string;
          p_checked_in_at: string;
          p_next_check_in: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      contact_method: "email" | "phone" | "both";
      reminder_status: "pending" | "sent" | "failed" | "cancelled";
      reminder_type:
        | "25_percent"
        | "50_percent"
        | "7_days"
        | "3_days"
        | "24_hours"
        | "12_hours"
        | "1_hour";
      secret_status: "active" | "paused" | "triggered";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  } ? keyof (
      & Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
      & Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database } ? (
    & Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    & Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (
    & DefaultSchema["Tables"]
    & DefaultSchema["Views"]
  ) ? (
      & DefaultSchema["Tables"]
      & DefaultSchema["Views"]
    )[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][
    TableName
  ] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][
    TableName
  ] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]][
      "CompositeTypes"
    ]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][
    CompositeTypeName
  ]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

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
    },
  },
} as const;
