import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
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
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
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
      exercise: {
        Row: {
          created_by_user: string | null;
          description: string;
          id: string;
          name: string;
          tags: Database["public"]["Enums"]["exercise_and_muscle_tag"][];
        };
        Insert: {
          created_by_user?: string | null;
          description: string;
          id?: string;
          name: string;
          tags: Database["public"]["Enums"]["exercise_and_muscle_tag"][];
        };
        Update: {
          created_by_user?: string | null;
          description?: string;
          id?: string;
          name?: string;
          tags?: Database["public"]["Enums"]["exercise_and_muscle_tag"][];
        };
        Relationships: [];
      };
      exercise_muscle: {
        Row: {
          exercise_id: string;
          id: string;
          muscle_id: Database["public"]["Enums"]["muscle_group"];
          user_id: string | null;
          volume_factor: number;
        };
        Insert: {
          exercise_id: string;
          id?: string;
          muscle_id: Database["public"]["Enums"]["muscle_group"];
          user_id?: string | null;
          volume_factor: number;
        };
        Update: {
          exercise_id?: string;
          id?: string;
          muscle_id?: Database["public"]["Enums"]["muscle_group"];
          user_id?: string | null;
          volume_factor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_muscle_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercise";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_muscle_muscle_id_fkey";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscle_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      muscle_groups: {
        Row: {
          description: string;
          display_name: string;
          id: Database["public"]["Enums"]["muscle_group"];
          tags: Database["public"]["Enums"]["exercise_and_muscle_tag"][];
        };
        Insert: {
          description: string;
          display_name: string;
          id: Database["public"]["Enums"]["muscle_group"];
          tags?: Database["public"]["Enums"]["exercise_and_muscle_tag"][];
        };
        Update: {
          description?: string;
          display_name?: string;
          id?: Database["public"]["Enums"]["muscle_group"];
          tags?: Database["public"]["Enums"]["exercise_and_muscle_tag"][];
        };
        Relationships: [];
      };
      program: {
        Row: {
          description: string;
          id: string;
          name: string;
          num_weeks: number;
          owned_by: string;
        };
        Insert: {
          description: string;
          id?: string;
          name: string;
          num_weeks?: number;
          owned_by: string;
        };
        Update: {
          description?: string;
          id?: string;
          name?: string;
          num_weeks?: number;
          owned_by?: string;
        };
        Relationships: [];
      };
      program_membership: {
        Row: {
          editor_role: Database["public"]["Enums"]["program_editor_role"];
          program_id: string;
          user_id: string;
        };
        Insert: {
          editor_role: Database["public"]["Enums"]["program_editor_role"];
          program_id: string;
          user_id: string;
        };
        Update: {
          editor_role?: Database["public"]["Enums"]["program_editor_role"];
          program_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_membership_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "program";
            referencedColumns: ["id"];
          },
        ];
      };
      tracked_user_item: {
        Row: {
          id: string;
          item_id: string;
          item_tag: Database["public"]["Enums"]["trackable_tag"];
          user_id: string;
        };
        Insert: {
          id?: string;
          item_id?: string;
          item_tag: Database["public"]["Enums"]["trackable_tag"];
          user_id: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          item_tag?: Database["public"]["Enums"]["trackable_tag"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_profile: {
        Row: {
          default_distance_unit: Database["public"]["Enums"]["distance_unit"];
          default_weight_unit: Database["public"]["Enums"]["weight_unit"];
          display_name: string;
          user_id: string;
        };
        Insert: {
          default_distance_unit?: Database["public"]["Enums"]["distance_unit"];
          default_weight_unit?: Database["public"]["Enums"]["weight_unit"];
          display_name: string;
          user_id: string;
        };
        Update: {
          default_distance_unit?: Database["public"]["Enums"]["distance_unit"];
          default_weight_unit?: Database["public"]["Enums"]["weight_unit"];
          display_name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      workout_exercise_log: {
        Row: {
          exercise_id: string;
          exercise_index: number;
          id: string;
          notes: string;
          superset_group: number | null;
          workout_id: string;
        };
        Insert: {
          exercise_id: string;
          exercise_index: number;
          id?: string;
          notes?: string;
          superset_group?: number | null;
          workout_id: string;
        };
        Update: {
          exercise_id?: string;
          exercise_index?: number;
          id?: string;
          notes?: string;
          superset_group?: number | null;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_exercise_log_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercise";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_exercise_log_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: false;
            referencedRelation: "workout_log";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_exercise_set_log: {
        Row: {
          distance_per_rep: number | null;
          distance_unit: Database["public"]["Enums"]["distance_unit"];
          duration: number | null;
          id: string;
          max_percentage_exercise_id: string | null;
          percentage_of_max: number | null;
          performance_type: Database["public"]["Enums"]["log_performance_type"];
          reps: number | null;
          rest_seconds_before: number | null;
          rpe: number | null;
          set_index: number;
          set_type: Database["public"]["Enums"]["set_type"] | null;
          time_unit: Database["public"]["Enums"]["time_unit"];
          weight: number | null;
          weight_unit: Database["public"]["Enums"]["weight_unit"];
          workout_exercise_id: string;
        };
        Insert: {
          distance_per_rep?: number | null;
          distance_unit: Database["public"]["Enums"]["distance_unit"];
          duration?: number | null;
          id?: string;
          max_percentage_exercise_id?: string | null;
          percentage_of_max?: number | null;
          performance_type: Database["public"]["Enums"]["log_performance_type"];
          reps?: number | null;
          rest_seconds_before?: number | null;
          rpe?: number | null;
          set_index: number;
          set_type?: Database["public"]["Enums"]["set_type"] | null;
          time_unit?: Database["public"]["Enums"]["time_unit"];
          weight?: number | null;
          weight_unit: Database["public"]["Enums"]["weight_unit"];
          workout_exercise_id: string;
        };
        Update: {
          distance_per_rep?: number | null;
          distance_unit?: Database["public"]["Enums"]["distance_unit"];
          duration?: number | null;
          id?: string;
          max_percentage_exercise_id?: string | null;
          percentage_of_max?: number | null;
          performance_type?: Database["public"]["Enums"]["log_performance_type"];
          reps?: number | null;
          rest_seconds_before?: number | null;
          rpe?: number | null;
          set_index?: number;
          set_type?: Database["public"]["Enums"]["set_type"] | null;
          time_unit?: Database["public"]["Enums"]["time_unit"];
          weight?: number | null;
          weight_unit?: Database["public"]["Enums"]["weight_unit"];
          workout_exercise_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_exercise_set_log_max_percentage_exercise_id_fkey";
            columns: ["max_percentage_exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercise";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_exercise_set_log_workout_exercise_id_fkey";
            columns: ["workout_exercise_id"];
            isOneToOne: false;
            referencedRelation: "workout_exercise_log";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_log: {
        Row: {
          block_in_program: number | null;
          bodyweight: number | null;
          bodyweight_unit: Database["public"]["Enums"]["weight_unit"];
          completed_on: string;
          day_in_week: number | null;
          duration: number | null;
          duration_unit: Database["public"]["Enums"]["time_unit"];
          id: string;
          name: string;
          notes: string;
          program_id: string | null;
          user_id: string;
          week_in_block: number | null;
          workout_type: Database["public"]["Enums"]["workout_type"] | null;
        };
        Insert: {
          block_in_program?: number | null;
          bodyweight?: number | null;
          bodyweight_unit?: Database["public"]["Enums"]["weight_unit"];
          completed_on: string;
          day_in_week?: number | null;
          duration?: number | null;
          duration_unit?: Database["public"]["Enums"]["time_unit"];
          id?: string;
          name: string;
          notes?: string;
          program_id?: string | null;
          user_id: string;
          week_in_block?: number | null;
          workout_type?: Database["public"]["Enums"]["workout_type"] | null;
        };
        Update: {
          block_in_program?: number | null;
          bodyweight?: number | null;
          bodyweight_unit?: Database["public"]["Enums"]["weight_unit"];
          completed_on?: string;
          day_in_week?: number | null;
          duration?: number | null;
          duration_unit?: Database["public"]["Enums"]["time_unit"];
          id?: string;
          name?: string;
          notes?: string;
          program_id?: string | null;
          user_id?: string;
          week_in_block?: number | null;
          workout_type?: Database["public"]["Enums"]["workout_type"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "workout_log_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "program";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      distance_unit: "m" | "km" | "mi" | "ft" | "yd";
      exercise_and_muscle_tag:
        | "push"
        | "pull"
        | "legs"
        | "upper"
        | "lower"
        | "abs";
      log_performance_type: "weight" | "movement";
      muscle_group:
        | "chest"
        | "upper_back"
        | "lats"
        | "traps"
        | "front_delts"
        | "side_delts"
        | "rear_delts"
        | "biceps"
        | "triceps"
        | "forearms"
        | "abs"
        | "lower_back"
        | "spinal_erectors"
        | "glutes"
        | "adductors"
        | "abductors"
        | "quads"
        | "hamstrings"
        | "calves"
        | "neck";
      program_editor_role: "owner" | "viewer" | "editor";
      set_type: "warmup" | "top" | "backoff";
      time_unit: "sec" | "min" | "hr";
      trackable_tag: "program";
      weight_unit: "kg" | "lb";
      workout_type: "deload" | "test";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      distance_unit: ["m", "km", "mi", "ft", "yd"],
      exercise_and_muscle_tag: [
        "push",
        "pull",
        "legs",
        "upper",
        "lower",
        "abs",
      ],
      log_performance_type: ["weight", "movement"],
      muscle_group: [
        "chest",
        "upper_back",
        "lats",
        "traps",
        "front_delts",
        "side_delts",
        "rear_delts",
        "biceps",
        "triceps",
        "forearms",
        "abs",
        "lower_back",
        "spinal_erectors",
        "glutes",
        "adductors",
        "abductors",
        "quads",
        "hamstrings",
        "calves",
        "neck",
      ],
      program_editor_role: ["owner", "viewer", "editor"],
      set_type: ["warmup", "top", "backoff"],
      time_unit: ["sec", "min", "hr"],
      trackable_tag: ["program"],
      weight_unit: ["kg", "lb"],
      workout_type: ["deload", "test"],
    },
  },
} as const;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
