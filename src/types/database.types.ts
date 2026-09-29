export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
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
      itineraries: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          notes: string | null;
          returns_to_start: boolean;
          travel_mode: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          notes?: string | null;
          returns_to_start?: boolean;
          travel_mode?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          notes?: string | null;
          returns_to_start?: boolean;
          travel_mode?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      legs: {
        Row: {
          created_at: string;
          distance_km: number;
          duration_min: number | null;
          from_stop_id: string | null;
          id: string;
          is_estimate: boolean;
          itinerary_id: string;
          route_geometry: Json | null;
          source: string;
          to_stop_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          distance_km: number;
          duration_min?: number | null;
          from_stop_id?: string | null;
          id?: string;
          is_estimate?: boolean;
          itinerary_id: string;
          route_geometry?: Json | null;
          source?: string;
          to_stop_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          distance_km?: number;
          duration_min?: number | null;
          from_stop_id?: string | null;
          id?: string;
          is_estimate?: boolean;
          itinerary_id?: string;
          route_geometry?: Json | null;
          source?: string;
          to_stop_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'legs_from_stop_id_fkey';
            columns: ['from_stop_id'];
            isOneToOne: false;
            referencedRelation: 'stops';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'legs_itinerary_id_fkey';
            columns: ['itinerary_id'];
            isOneToOne: false;
            referencedRelation: 'itineraries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'legs_itinerary_id_fkey';
            columns: ['itinerary_id'];
            isOneToOne: false;
            referencedRelation: 'itinerary_totals';
            referencedColumns: ['itinerary_id'];
          },
          {
            foreignKeyName: 'legs_to_stop_id_fkey';
            columns: ['to_stop_id'];
            isOneToOne: false;
            referencedRelation: 'stops';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          default_start_address: string | null;
          default_start_lat: number | null;
          default_start_lng: number | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_start_address?: string | null;
          default_start_lat?: number | null;
          default_start_lng?: number | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_start_address?: string | null;
          default_start_lat?: number | null;
          default_start_lng?: number | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stops: {
        Row: {
          address: string | null;
          created_at: string;
          id: string;
          is_start: boolean;
          itinerary_id: string;
          label: string;
          lat: number | null;
          lng: number | null;
          notes: string | null;
          planned_time: string | null;
          position: number;
          reached_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          id?: string;
          is_start?: boolean;
          itinerary_id: string;
          label: string;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          planned_time?: string | null;
          position: number;
          reached_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          id?: string;
          is_start?: boolean;
          itinerary_id?: string;
          label?: string;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          planned_time?: string | null;
          position?: number;
          reached_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stops_itinerary_id_fkey';
            columns: ['itinerary_id'];
            isOneToOne: false;
            referencedRelation: 'itineraries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stops_itinerary_id_fkey';
            columns: ['itinerary_id'];
            isOneToOne: false;
            referencedRelation: 'itinerary_totals';
            referencedColumns: ['itinerary_id'];
          },
        ];
      };
    };
    Views: {
      itinerary_totals: {
        Row: {
          date: string | null;
          estimated_legs_count: number | null;
          has_start: boolean | null;
          itinerary_id: string | null;
          legs_count: number | null;
          manual_legs_count: number | null;
          reached_count: number | null;
          returns_to_start: boolean | null;
          stops_count: number | null;
          total_duration_min: number | null;
          total_km: number | null;
          travel_mode: string | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      delete_stop: { Args: { p_stop_id: string }; Returns: number };
      duplicate_itinerary: {
        Args: { p_itinerary_id: string; p_overwrite?: boolean; p_target_date: string };
        Returns: {
          created_at: string;
          date: string;
          id: string;
          notes: string | null;
          returns_to_start: boolean;
          travel_mode: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'itineraries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      insert_stop_at: {
        Args: {
          p_address?: string;
          p_is_start?: boolean;
          p_itinerary_id: string;
          p_label: string;
          p_lat?: number;
          p_lng?: number;
          p_notes?: string;
          p_planned_time?: string;
          p_position?: number;
        };
        Returns: {
          address: string | null;
          created_at: string;
          id: string;
          is_start: boolean;
          itinerary_id: string;
          label: string;
          lat: number | null;
          lng: number | null;
          notes: string | null;
          planned_time: string | null;
          position: number;
          reached_at: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'stops';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      invalida_tratte_non_adiacenti: { Args: { p_itinerary_id: string }; Returns: number };
      owns_itinerary: { Args: { p_itinerary_id: string }; Returns: boolean };
      reorder_stops: { Args: { p_itinerary_id: string; p_ordered_ids: string[] }; Returns: number };
      riepilogo_obiettivi: {
        Args: { p_oggi?: string };
        Returns: {
          giornate_attive: number;
          km_percorsi: number;
          tappe_raggiunte: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
