export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      channels: {
        Row: {
          id: string
          owner_id: string
          slug: string
          display_name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          slug: string
          display_name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          slug?: string
          display_name?: string | null
          description?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      live_sessions: {
        Row: {
          id: string
          channel_id: string
          status: Database["public"]["Enums"]["session_status"]
          started_at: string | null
          ended_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          status?: Database["public"]["Enums"]["session_status"]
          started_at?: string | null
          ended_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          channel_id?: string
          status?: Database["public"]["Enums"]["session_status"]
          started_at?: string | null
          ended_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          }
        ]
      }
      stream_destinations: {
        Row: {
          id: string
          session_id: string
          platform: Database["public"]["Enums"]["stream_platform"]
          rtmp_url: string
          stream_key: string
          status: Database["public"]["Enums"]["destination_status"]
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          platform: Database["public"]["Enums"]["stream_platform"]
          rtmp_url: string
          stream_key: string
          status?: Database["public"]["Enums"]["destination_status"]
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          platform?: Database["public"]["Enums"]["stream_platform"]
          rtmp_url?: string
          stream_key?: string
          status?: Database["public"]["Enums"]["destination_status"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_destinations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          }
        ]
      }
      participants: {
        Row: {
          id: string
          session_id: string
          user_id: string | null
          display_name: string
          platform_origin: Database["public"]["Enums"]["stream_platform"]
          status: Database["public"]["Enums"]["participant_status"]
          slot_index: number | null
          joined_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id?: string | null
          display_name: string
          platform_origin: Database["public"]["Enums"]["stream_platform"]
          status?: Database["public"]["Enums"]["participant_status"]
          slot_index?: number | null
          joined_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string | null
          display_name?: string
          platform_origin?: Database["public"]["Enums"]["stream_platform"]
          status?: Database["public"]["Enums"]["participant_status"]
          slot_index?: number | null
          joined_at?: string
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
          }
        ]
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          platform: Database["public"]["Enums"]["stream_platform"]
          author_display_name: string
          author_avatar_url: string | null
          body: string
          timestamp: string
        }
        Insert: {
          id?: string
          session_id: string
          platform: Database["public"]["Enums"]["stream_platform"]
          author_display_name: string
          author_avatar_url?: string | null
          body: string
          timestamp?: string
        }
        Update: {
          id?: string
          session_id?: string
          platform?: Database["public"]["Enums"]["stream_platform"]
          author_display_name?: string
          author_avatar_url?: string | null
          body?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      stream_platform: "twitch" | "youtube" | "tiktok" | "kick" | "ditch"
      session_status: "idle" | "live" | "ending" | "ended"
      participant_status: "waiting" | "approved" | "live" | "removed"
      destination_status: "connecting" | "live" | "error" | "stopped"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
