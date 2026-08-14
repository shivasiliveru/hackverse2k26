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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_setup: {
        Row: {
          access_code: string
          created_at: string
          id: number
        }
        Insert: {
          access_code: string
          created_at?: string
          id?: number
        }
        Update: {
          access_code?: string
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      allocations: {
        Row: {
          allocation_number: number
          created_at: string
          domain_id: string
          id: string
          problem_statement_id: string
          selected_at: string
          status: string
          team_id: string
        }
        Insert: {
          allocation_number: number
          created_at?: string
          domain_id: string
          id?: string
          problem_statement_id: string
          selected_at?: string
          status?: string
          team_id: string
        }
        Update: {
          allocation_number?: number
          created_at?: string
          domain_id?: string
          id?: string
          problem_statement_id?: string
          selected_at?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_problem_statement_id_fkey"
            columns: ["problem_statement_id"]
            isOneToOne: false
            referencedRelation: "problem_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor: string | null
          created_at: string
          event: string
          id: string
          metadata: Json
          problem_statement_ref: string | null
          team_ref: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event: string
          id?: string
          metadata?: Json
          problem_statement_ref?: string | null
          team_ref?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          event?: string
          id?: string
          metadata?: Json
          problem_statement_ref?: string | null
          team_ref?: string | null
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_settings: {
        Row: {
          default_capacity: number
          event_name: string
          id: number
          max_allocated_teams: number
          selection_status: string
          total_registered_teams: number
          updated_at: string
        }
        Insert: {
          default_capacity?: number
          event_name?: string
          id?: number
          max_allocated_teams?: number
          selection_status?: string
          total_registered_teams?: number
          updated_at?: string
        }
        Update: {
          default_capacity?: number
          event_name?: string
          id?: number
          max_allocated_teams?: number
          selection_status?: string
          total_registered_teams?: number
          updated_at?: string
        }
        Relationships: []
      }
      problem_statements: {
        Row: {
          allocated_count: number
          capacity: number
          created_at: string
          description: string
          domain_id: string
          expected_solution: string
          full_description: string
          id: string
          problem_statement_id: string
          remaining_slots: number | null
          requirements: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          allocated_count?: number
          capacity?: number
          created_at?: string
          description?: string
          domain_id: string
          expected_solution?: string
          full_description?: string
          id?: string
          problem_statement_id: string
          remaining_slots?: number | null
          requirements?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          allocated_count?: number
          capacity?: number
          created_at?: string
          description?: string
          domain_id?: string
          expected_solution?: string
          full_description?: string
          id?: string
          problem_statement_id?: string
          remaining_slots?: number | null
          requirements?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_statements_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          allocation_status: string
          created_at: string
          id: string
          is_sample: boolean
          leader_name: string | null
          selected_at: string | null
          selected_problem_statement_id: string | null
          status: string
          team_id: string
          team_name: string
          updated_at: string
        }
        Insert: {
          allocation_status?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          leader_name?: string | null
          selected_at?: string | null
          selected_problem_statement_id?: string | null
          status?: string
          team_id: string
          team_name: string
          updated_at?: string
        }
        Update: {
          allocation_status?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          leader_name?: string | null
          selected_at?: string | null
          selected_problem_statement_id?: string | null
          status?: string
          team_id?: string
          team_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_selected_problem_statement_id_fkey"
            columns: ["selected_problem_statement_id"]
            isOneToOne: false
            referencedRelation: "problem_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_stats: {
        Row: {
          allocated_teams: number | null
          available_ps_slots: number | null
          max_allocated_teams: number | null
          selection_status: string | null
          total_problem_statements: number | null
          total_registered_teams: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      allocate_problem_statement: {
        Args: { p_ps_code: string; p_team_code: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
