export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          description: string | null
          icon: string
          id: string
          order_index: number
          stage_id: string | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          video_url: string | null
        }
        Insert: {
          description?: string | null
          icon?: string
          id?: string
          order_index?: number
          stage_id?: string | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          video_url?: string | null
        }
        Update: {
          description?: string | null
          icon?: string
          id?: string
          order_index?: number
          stage_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          activity_id: string | null
          couple_id: string | null
          created_at: string
          id: string
          type: Database["public"]["Enums"]["conversation_type"]
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          couple_id?: string | null
          created_at?: string
          id?: string
          type?: Database["public"]["Enums"]["conversation_type"]
          user_id: string
        }
        Update: {
          activity_id?: string | null
          couple_id?: string | null
          created_at?: string
          id?: string
          type?: Database["public"]["Enums"]["conversation_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          partner_since: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          partner_since?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          partner_since?: string | null
        }
        Relationships: []
      }
      financial_plans: {
        Row: {
          couple_id: string
          created_at: string
          current_amount: number
          icon: string
          id: string
          target_amount: number
          title: string
          updated_at: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          current_amount?: number
          icon?: string
          id?: string
          target_amount?: number
          title: string
          updated_at?: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          current_amount?: number
          icon?: string
          id?: string
          target_amount?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_plans_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["message_role"]
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["message_role"]
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["message_role"]
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          couple_id: string | null
          created_at: string
          display_name: string
          id: string
          onboarding_completed: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          couple_id?: string | null
          created_at?: string
          display_name?: string
          id: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          couple_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          description: string | null
          goal: string | null
          icon: string
          id: string
          order_index: number
          title: string
        }
        Insert: {
          description?: string | null
          goal?: string | null
          icon?: string
          id?: string
          order_index?: number
          title: string
        }
        Update: {
          description?: string | null
          goal?: string | null
          icon?: string
          id?: string
          order_index?: number
          title?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          activity_id: string
          completed_at: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["activity_status"]
          user_id: string
        }
        Insert: {
          activity_id: string
          completed_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          user_id: string
        }
        Update: {
          activity_id?: string
          completed_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          help_topics: string[] | null
          id: string
          money_talk_frequency: string | null
          relationship_duration: string | null
          updated_at: string
          usage_intent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          help_topics?: string[] | null
          id?: string
          money_talk_frequency?: string | null
          relationship_duration?: string | null
          updated_at?: string
          usage_intent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          help_topics?: string[] | null
          id?: string
          money_talk_frequency?: string | null
          relationship_duration?: string | null
          updated_at?: string
          usage_intent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_couple_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      activity_status: "locked" | "available" | "in_progress" | "completed"
      activity_type: "conversation" | "lesson" | "planning"
      conversation_type: "solo" | "together" | "face_to_face"
      message_role: "user" | "partner" | "ai"
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
  public: {
    Enums: {
      activity_status: ["locked", "available", "in_progress", "completed"],
      activity_type: ["conversation", "lesson", "planning"],
      conversation_type: ["solo", "together", "face_to_face"],
      message_role: ["user", "partner", "ai"],
    },
  },
} as const
