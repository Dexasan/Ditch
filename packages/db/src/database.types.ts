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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      channel_memberships: {
        Row: {
          channel_id: string
          joined_at: string
          notification_level: string
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          notification_level?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          notification_level?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_memberships_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          owner_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          owner_id: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          owner_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_avatar_url: string | null
          author_display_name: string
          body: string
          id: string
          platform: Database["public"]["Enums"]["stream_platform"]
          session_id: string
          timestamp: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_display_name: string
          body: string
          id?: string
          platform: Database["public"]["Enums"]["stream_platform"]
          session_id: string
          timestamp?: string
        }
        Update: {
          author_avatar_url?: string | null
          author_display_name?: string
          body?: string
          id?: string
          platform?: Database["public"]["Enums"]["stream_platform"]
          session_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_notifications: {
        Row: {
          actor_id: string | null
          body: string
          channel_id: string
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          read_at: string | null
          recipient_id: string
          type: Database["public"]["Enums"]["community_notification_type"]
        }
        Insert: {
          actor_id?: string | null
          body: string
          channel_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          recipient_id: string
          type: Database["public"]["Enums"]["community_notification_type"]
        }
        Update: {
          actor_id?: string | null
          body?: string
          channel_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          recipient_id?: string
          type?: Database["public"]["Enums"]["community_notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "community_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_notifications_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          from_status:
            | Database["public"]["Enums"]["community_post_status"]
            | null
          id: string
          post_id: string
          session_id: string | null
          to_status: Database["public"]["Enums"]["community_post_status"] | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          from_status?:
            | Database["public"]["Enums"]["community_post_status"]
            | null
          id?: string
          post_id: string
          session_id?: string | null
          to_status?:
            | Database["public"]["Enums"]["community_post_status"]
            | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          from_status?:
            | Database["public"]["Enums"]["community_post_status"]
            | null
          id?: string
          post_id?: string
          session_id?: string | null
          to_status?:
            | Database["public"]["Enums"]["community_post_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "community_post_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          body: string | null
          channel_id: string
          created_at: string
          creator_response: string | null
          id: string
          is_pinned: boolean
          media_url: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["community_post_status"]
          title: string
          type: Database["public"]["Enums"]["community_post_type"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          channel_id: string
          created_at?: string
          creator_response?: string | null
          id?: string
          is_pinned?: boolean
          media_url?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["community_post_status"]
          title: string
          type: Database["public"]["Enums"]["community_post_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          channel_id?: string
          created_at?: string
          creator_response?: string | null
          id?: string
          is_pinned?: boolean
          media_url?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["community_post_status"]
          title?: string
          type?: Database["public"]["Enums"]["community_post_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_votes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          channel_id: string
          created_at: string
          ended_at: string | null
          id: string
          source_type: Database["public"]["Enums"]["session_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"]
        }
        Insert: {
          channel_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          source_type?: Database["public"]["Enums"]["session_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
        }
        Update: {
          channel_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          source_type?: Database["public"]["Enums"]["session_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          display_name: string
          id: string
          joined_at: string
          platform_origin: Database["public"]["Enums"]["stream_platform"]
          session_id: string
          slot_index: number | null
          status: Database["public"]["Enums"]["participant_status"]
          user_id: string | null
        }
        Insert: {
          display_name: string
          id?: string
          joined_at?: string
          platform_origin: Database["public"]["Enums"]["stream_platform"]
          session_id: string
          slot_index?: number | null
          status?: Database["public"]["Enums"]["participant_status"]
          user_id?: string | null
        }
        Update: {
          display_name?: string
          id?: string
          joined_at?: string
          platform_origin?: Database["public"]["Enums"]["stream_platform"]
          session_id?: string
          slot_index?: number | null
          status?: Database["public"]["Enums"]["participant_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_destinations: {
        Row: {
          channel_id: string
          channel_ref: string | null
          created_at: string
          id: string
          label: string | null
          platform: Database["public"]["Enums"]["stream_platform"]
          rtmp_url: string
          stream_key: string
        }
        Insert: {
          channel_id: string
          channel_ref?: string | null
          created_at?: string
          id?: string
          label?: string | null
          platform: Database["public"]["Enums"]["stream_platform"]
          rtmp_url: string
          stream_key: string
        }
        Update: {
          channel_id?: string
          channel_ref?: string | null
          created_at?: string
          id?: string
          label?: string | null
          platform?: Database["public"]["Enums"]["stream_platform"]
          rtmp_url?: string
          stream_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_destinations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      show_rundown_items: {
        Row: {
          added_at: string
          id: string
          position: number
          post_id: string
          session_id: string
          state: Database["public"]["Enums"]["rundown_item_state"]
          used_at: string | null
        }
        Insert: {
          added_at?: string
          id?: string
          position?: number
          post_id: string
          session_id: string
          state?: Database["public"]["Enums"]["rundown_item_state"]
          used_at?: string | null
        }
        Update: {
          added_at?: string
          id?: string
          position?: number
          post_id?: string
          session_id?: string
          state?: Database["public"]["Enums"]["rundown_item_state"]
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "show_rundown_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_rundown_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_destinations: {
        Row: {
          channel_ref: string | null
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["stream_platform"]
          rtmp_url: string
          session_id: string
          status: Database["public"]["Enums"]["destination_status"]
          stream_key: string
        }
        Insert: {
          channel_ref?: string | null
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["stream_platform"]
          rtmp_url: string
          session_id: string
          status?: Database["public"]["Enums"]["destination_status"]
          stream_key: string
        }
        Update: {
          channel_ref?: string | null
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["stream_platform"]
          rtmp_url?: string
          session_id?: string
          status?: Database["public"]["Enums"]["destination_status"]
          stream_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_destinations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      community_notification_type:
        | "comment"
        | "creator_response"
        | "status_change"
        | "used_on_stream"
      community_post_status:
        | "open"
        | "shortlisted"
        | "planned"
        | "used"
        | "completed"
        | "declined"
      community_post_type: "moment" | "discussion" | "suggestion"
      destination_status: "connecting" | "live" | "error" | "stopped" | "idle"
      participant_status: "waiting" | "approved" | "live" | "removed"
      rundown_item_state: "planned" | "used" | "skipped"
      session_source: "browser" | "rtmp"
      session_status: "idle" | "live" | "ending" | "ended"
      stream_platform: "twitch" | "youtube" | "tiktok" | "kick" | "ditch"
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
      community_notification_type: [
        "comment",
        "creator_response",
        "status_change",
        "used_on_stream",
      ],
      community_post_status: [
        "open",
        "shortlisted",
        "planned",
        "used",
        "completed",
        "declined",
      ],
      community_post_type: ["moment", "discussion", "suggestion"],
      destination_status: ["connecting", "live", "error", "stopped", "idle"],
      participant_status: ["waiting", "approved", "live", "removed"],
      rundown_item_state: ["planned", "used", "skipped"],
      session_source: ["browser", "rtmp"],
      session_status: ["idle", "live", "ending", "ended"],
      stream_platform: ["twitch", "youtube", "tiktok", "kick", "ditch"],
    },
  },
} as const
