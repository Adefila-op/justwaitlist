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
      participants: {
        Row: {
          code: string
          created_at: string
          minted: boolean
          minted_at: string | null
          referred_by: string | null
          substack_opened: boolean
          wallet: string | null
        }
        Insert: {
          code: string
          created_at?: string
          minted?: boolean
          minted_at?: string | null
          referred_by?: string | null
          substack_opened?: boolean
          wallet?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          minted?: boolean
          minted_at?: string | null
          referred_by?: string | null
          substack_opened?: boolean
          wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["code"]
          },
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
