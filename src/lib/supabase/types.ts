export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Views: {};
    Functions: {};
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          avatar_url?: string | null;
        };
        Update: {
          email?: string;
          display_name?: string;
          avatar_url?: string | null;
        };
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          settings?: Json;
        };
        Update: {
          name?: string;
          slug?: string;
          logo_url?: string | null;
          settings?: Json;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          member_id: string;
          role: string;
          permissions: string[];
          joined_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          member_id: string;
          role?: string;
          permissions?: string[];
        };
        Update: {
          role?: string;
          permissions?: string[];
        };
      };
      competitions: {
        Row: {
          id: string;
          organization_id: string;
          blueprint_id: string | null;
          name: string;
          description: string;
          logo_url: string | null;
          visibility: string;
          game: Json | null;
          date_start: string | null;
          date_end: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          blueprint_id?: string | null;
          name: string;
          description?: string;
          logo_url?: string | null;
          visibility?: string;
          game?: Json | null;
          date_start?: string | null;
          date_end?: string | null;
          status?: string;
        };
        Update: {
          name?: string;
          description?: string;
          logo_url?: string | null;
          visibility?: string;
          game?: Json | null;
          date_start?: string | null;
          date_end?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          competition_id: string;
          name: string;
          format: string;
          participant_type: string;
          max_participants: number | null;
          min_participants: number | null;
          status: string;
          registration_policy: string;
          config: Json;
          date_start: string | null;
          date_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          name: string;
          format: string;
          participant_type?: string;
          max_participants?: number | null;
          min_participants?: number | null;
          status?: string;
          registration_policy?: string;
          config?: Json;
          date_start?: string | null;
          date_end?: string | null;
        };
        Update: {
          name?: string;
          format?: string;
          participant_type?: string;
          max_participants?: number | null;
          min_participants?: number | null;
          status?: string;
          registration_policy?: string;
          config?: Json;
          date_start?: string | null;
          date_end?: string | null;
        };
        Relationships: [];
      };
      stages: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          type: string;
          order_index: number;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          type: string;
          order_index?: number;
          config?: Json;
        };
        Update: {
          name?: string;
          type?: string;
          order_index?: number;
          config?: Json;
        };
      };
      rounds: {
        Row: {
          id: string;
          stage_id: string;
          name: string;
          round_number: number;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          stage_id: string;
          name: string;
          round_number: number;
          config?: Json;
        };
        Update: {
          name?: string;
          round_number?: number;
          config?: Json;
        };
      };
      matches: {
        Row: {
          id: string;
          round_id: string;
          event_id: string;
          bracket_group: string | null;
          status: string;
          winner_id: string | null;
          scores: Json | null;
          is_walkover: boolean;
          notes: string | null;
          finalized_by: string | null;
          finalized_at: string | null;
          scheduled_at: string | null;
          started_at: string | null;
          venue: string | null;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          round_id: string;
          event_id: string;
          bracket_group?: string | null;
          status?: string;
          winner_id?: string | null;
          scores?: Json | null;
          is_walkover?: boolean;
          notes?: string | null;
          finalized_by?: string | null;
          finalized_at?: string | null;
          scheduled_at?: string | null;
          started_at?: string | null;
          venue?: string | null;
          config?: Json;
        };
        Update: {
          status?: string;
          winner_id?: string | null;
          scores?: Json | null;
          is_walkover?: boolean;
          notes?: string | null;
          finalized_by?: string | null;
          finalized_at?: string | null;
          scheduled_at?: string | null;
          started_at?: string | null;
          venue?: string | null;
          config?: Json;
        };
      };
      match_participants: {
        Row: {
          match_id: string;
          participant_id: string;
          position: number;
          result: string | null;
          score: number | null;
        };
        Insert: {
          match_id: string;
          participant_id: string;
          position: number;
          result?: string | null;
          score?: number | null;
        };
        Update: {
          result?: string | null;
          score?: number | null;
        };
      };
      participants: {
        Row: {
          id: string;
          event_id: string;
          member_id: string | null;
          team_id: string | null;
          display_name: string;
          seed: number | null;
          status: string;
          registered_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          member_id?: string | null;
          team_id?: string | null;
          display_name: string;
          seed?: number | null;
          status?: string;
        };
        Update: {
          display_name?: string;
          seed?: number | null;
          status?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          member_ids: string[];
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          member_ids?: string[];
          avatar_url?: string | null;
        };
        Update: {
          name?: string;
          member_ids?: string[];
          avatar_url?: string | null;
        };
      };
      rule_sets: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          rules: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          rules?: Json;
        };
        Update: {
          name?: string;
          rules?: Json;
        };
      };
      bets: {
        Row: {
          id: string;
          match_id: string;
          event_id: string;
          participant_id: string;
          better_id: string;
          better_name: string;
          points_wagered: number;
          placed_at: string;
          settled: boolean;
          won: boolean;
          points_awarded: number;
        };
        Insert: {
          id?: string;
          match_id: string;
          event_id: string;
          participant_id: string;
          better_id: string;
          better_name: string;
          points_wagered: number;
          settled?: boolean;
          won?: boolean;
          points_awarded?: number;
        };
        Update: {
          settled?: boolean;
          won?: boolean;
          points_awarded?: number;
        };
      };
      better_profiles: {
        Row: {
          id: string;
          name: string;
          total_points: number;
          bets_won: number;
          bets_lost: number;
          total_wagered: number;
          net_points: number;
        };
        Insert: {
          id?: string;
          name: string;
          total_points?: number;
          bets_won?: number;
          bets_lost?: number;
          total_wagered?: number;
          net_points?: number;
        };
        Update: {
          name?: string;
          total_points?: number;
          bets_won?: number;
          bets_lost?: number;
          total_wagered?: number;
          net_points?: number;
        };
      };
      invites: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: string;
          token: string;
          status: string;
          invited_by: string;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: string;
          token: string;
          status?: string;
          invited_by: string;
          accepted_at?: string | null;
        };
        Update: {
          status?: string;
          accepted_at?: string | null;
        };
      };
      competition_invites: {
        Row: {
          id: string;
          competition_id: string;
          organization_id: string;
          label: string;
          token: string;
          status: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          organization_id: string;
          label: string;
          token: string;
          status?: string;
          created_by: string;
        };
        Update: {
          status?: string;
        };
      };
      participant_invites: {
        Row: {
          id: string;
          event_id: string;
          competition_id: string;
          email: string;
          display_name: string;
          token: string;
          status: string;
          invited_by: string;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          competition_id: string;
          email: string;
          display_name: string;
          token: string;
          status?: string;
          invited_by: string;
          accepted_at?: string | null;
        };
        Update: {
          status?: string;
          accepted_at?: string | null;
        };
      };
      audit_entries: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string;
          action: string;
          resource_type: string;
          resource_id: string;
          diff: Json;
          snapshot: Json;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_id: string;
          action: string;
          resource_type: string;
          resource_id: string;
          diff?: Json;
          snapshot?: Json;
          metadata?: Json;
        };
      };
      score_audit_entries: {
        Row: {
          id: string;
          match_id: string;
          event_id: string;
          participant_id: string;
          score: number;
          action_type: string;
          timestamp: string;
          match_elapsed_ms: number | null;
          round_number: number | null;
          stage_name: string | null;
        };
        Insert: {
          id?: string;
          match_id: string;
          event_id: string;
          participant_id: string;
          score: number;
          action_type: string;
          match_elapsed_ms?: number | null;
          round_number?: number | null;
          stage_name?: string | null;
        };
      };
      match_timings: {
        Row: {
          id: string;
          match_id: string;
          event_id: string;
          started_at: string;
          finalized_at: string | null;
          duration_ms: number | null;
        };
        Insert: {
          id?: string;
          match_id: string;
          event_id: string;
          started_at: string;
          finalized_at?: string | null;
          duration_ms?: number | null;
        };
        Update: {
          finalized_at?: string | null;
          duration_ms?: number | null;
        };
      };
      progression_links: {
        Row: {
          id: string;
          event_id: string;
          source_stage_id: string;
          target_stage_id: string;
          qualifier_count: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          source_stage_id: string;
          target_stage_id: string;
          qualifier_count: number;
          status?: string;
        };
        Update: {
          status?: string;
        };
      };
      championship_points: {
        Row: {
          id: string;
          event_id: string;
          participant_id: string;
          points: number;
        };
        Insert: {
          id?: string;
          event_id: string;
          participant_id: string;
          points?: number;
        };
        Update: {
          points?: number;
        };
      };
    };
  };
}
