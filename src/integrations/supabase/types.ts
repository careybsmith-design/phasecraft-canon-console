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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      adapter_bindings: {
        Row: {
          adapter: string
          environment: string
          mode: string
        }
        Insert: {
          adapter: string
          environment: string
          mode: string
        }
        Update: {
          adapter?: string
          environment?: string
          mode?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          a2a_card: Json | null
          authority_ceiling: Database["public"]["Enums"]["authority_level"]
          cost_cap: number
          id: string
          name: string
          quota: Json
          token_hash: string
        }
        Insert: {
          a2a_card?: Json | null
          authority_ceiling: Database["public"]["Enums"]["authority_level"]
          cost_cap: number
          id: string
          name: string
          quota: Json
          token_hash: string
        }
        Update: {
          a2a_card?: Json | null
          authority_ceiling?: Database["public"]["Enums"]["authority_level"]
          cost_cap?: number
          id?: string
          name?: string
          quota?: Json
          token_hash?: string
        }
        Relationships: []
      }
      authority_history: {
        Row: {
          at: string
          cause: string
          evidence_refs: string[]
          from_level: Database["public"]["Enums"]["authority_level"] | null
          id: number
          object_id: string
          to_level: Database["public"]["Enums"]["authority_level"]
          trigger_ref: string | null
        }
        Insert: {
          at?: string
          cause: string
          evidence_refs: string[]
          from_level?: Database["public"]["Enums"]["authority_level"] | null
          id?: number
          object_id: string
          to_level: Database["public"]["Enums"]["authority_level"]
          trigger_ref?: string | null
        }
        Update: {
          at?: string
          cause?: string
          evidence_refs?: string[]
          from_level?: Database["public"]["Enums"]["authority_level"] | null
          id?: number
          object_id?: string
          to_level?: Database["public"]["Enums"]["authority_level"]
          trigger_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authority_history_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      build_runs: {
        Row: {
          adapter_mode: string
          cost_actual: number | null
          cost_ceiling: number
          external_run_id: string | null
          object_id: string
          platform: string
          prompt_id: string
          replay_mode: string | null
          repro_key: Json
        }
        Insert: {
          adapter_mode: string
          cost_actual?: number | null
          cost_ceiling: number
          external_run_id?: string | null
          object_id: string
          platform: string
          prompt_id: string
          replay_mode?: string | null
          repro_key: Json
        }
        Update: {
          adapter_mode?: string
          cost_actual?: number | null
          cost_ceiling?: number
          external_run_id?: string | null
          object_id?: string
          platform?: string
          prompt_id?: string
          replay_mode?: string | null
          repro_key?: Json
        }
        Relationships: [
          {
            foreignKeyName: "build_runs_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: true
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "creation_prompts"
            referencedColumns: ["object_id"]
          },
        ]
      }
      canon_settings: {
        Row: {
          decided_by: string | null
          decision_id: string | null
          key: string
          status: string
          value: Json | null
        }
        Insert: {
          decided_by?: string | null
          decision_id?: string | null
          key: string
          status: string
          value?: Json | null
        }
        Update: {
          decided_by?: string | null
          decision_id?: string | null
          key?: string
          status?: string
          value?: Json | null
        }
        Relationships: []
      }
      confidence_history: {
        Row: {
          at: string
          bundle: Json
          computed_by: string
          id: number
          object_id: string
          overall: number
          rule_version: string
        }
        Insert: {
          at?: string
          bundle: Json
          computed_by: string
          id?: number
          object_id: string
          overall: number
          rule_version: string
        }
        Update: {
          at?: string
          bundle?: Json
          computed_by?: string
          id?: number
          object_id?: string
          overall?: number
          rule_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "confidence_history_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confidence_history_rule_version_fkey"
            columns: ["rule_version"]
            isOneToOne: false
            referencedRelation: "confidence_rules"
            referencedColumns: ["version"]
          },
        ]
      }
      confidence_rules: {
        Row: {
          definition: Json
          published_at: string
          version: string
        }
        Insert: {
          definition: Json
          published_at: string
          version: string
        }
        Update: {
          definition?: Json
          published_at?: string
          version?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          granted_at: string
          id: string
          modalities: string[]
          participant_id: string
          session_id: string
          withdrawn_at: string | null
        }
        Insert: {
          granted_at: string
          id: string
          modalities: string[]
          participant_id: string
          session_id: string
          withdrawn_at?: string | null
        }
        Update: {
          granted_at?: string
          id?: string
          modalities?: string[]
          participant_id?: string
          session_id?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      creation_prompts: {
        Row: {
          compiled_hash: string
          compiled_text: string
          object_id: string
          reuse_check_id: string
          source_behavior_ids: string[]
          template_id: string
          template_version: string
        }
        Insert: {
          compiled_hash: string
          compiled_text: string
          object_id: string
          reuse_check_id: string
          source_behavior_ids: string[]
          template_id: string
          template_version: string
        }
        Update: {
          compiled_hash?: string
          compiled_text?: string
          object_id?: string
          reuse_check_id?: string
          source_behavior_ids?: string[]
          template_id?: string
          template_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "creation_prompts_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: true
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creation_prompts_reuse_check_id_fkey"
            columns: ["reuse_check_id"]
            isOneToOne: false
            referencedRelation: "reuse_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      detector_findings: {
        Row: {
          accepted_by: string | null
          accepted_until: string | null
          created_at: string
          detector_key: string
          evidence: Json
          id: string
          object_id: string | null
          owner_id: string
          severity: string
          state: string
        }
        Insert: {
          accepted_by?: string | null
          accepted_until?: string | null
          created_at?: string
          detector_key: string
          evidence: Json
          id: string
          object_id?: string | null
          owner_id: string
          severity: string
          state: string
        }
        Update: {
          accepted_by?: string | null
          accepted_until?: string | null
          created_at?: string
          detector_key?: string
          evidence?: Json
          id?: string
          object_id?: string | null
          owner_id?: string
          severity?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "detector_findings_detector_key_fkey"
            columns: ["detector_key"]
            isOneToOne: false
            referencedRelation: "detectors"
            referencedColumns: ["key"]
          },
        ]
      }
      detectors: {
        Row: {
          event_triggers: string[] | null
          family: string
          key: string
          owner_id: string
          params: Json
          schedule: string | null
          version: string
        }
        Insert: {
          event_triggers?: string[] | null
          family: string
          key: string
          owner_id: string
          params: Json
          schedule?: string | null
          version: string
        }
        Update: {
          event_triggers?: string[] | null
          family?: string
          key?: string
          owner_id?: string
          params?: Json
          schedule?: string | null
          version?: string
        }
        Relationships: []
      }
      edges: {
        Row: {
          authority_used: Database["public"]["Enums"]["authority_level"]
          confidence: number | null
          created_at: string
          created_by: Json
          evidence_refs: string[]
          from_id: string
          id: string
          retired_at: string | null
          source: string
          to_id: string
          verb: string
        }
        Insert: {
          authority_used: Database["public"]["Enums"]["authority_level"]
          confidence?: number | null
          created_at?: string
          created_by: Json
          evidence_refs?: string[]
          from_id: string
          id: string
          retired_at?: string | null
          source: string
          to_id: string
          verb: string
        }
        Update: {
          authority_used?: Database["public"]["Enums"]["authority_level"]
          confidence?: number | null
          created_at?: string
          created_by?: Json
          evidence_refs?: string[]
          from_id?: string
          id?: string
          retired_at?: string | null
          source?: string
          to_id?: string
          verb?: string
        }
        Relationships: [
          {
            foreignKeyName: "edges_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edges_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edges_verb_fkey"
            columns: ["verb"]
            isOneToOne: false
            referencedRelation: "relationship_verbs"
            referencedColumns: ["verb"]
          },
        ]
      }
      extraction_spans: {
        Row: {
          char_end: number | null
          char_start: number | null
          end_ms: number | null
          object_id: string
          source_ref: string
          speaker_id: string | null
          start_ms: number | null
        }
        Insert: {
          char_end?: number | null
          char_start?: number | null
          end_ms?: number | null
          object_id: string
          source_ref: string
          speaker_id?: string | null
          start_ms?: number | null
        }
        Update: {
          char_end?: number | null
          char_start?: number | null
          end_ms?: number | null
          object_id?: string
          source_ref?: string
          speaker_id?: string | null
          start_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_spans_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      guardrails: {
        Row: {
          active: boolean
          category: string
          evaluator: string
          id: string
          params: Json
          version: string
        }
        Insert: {
          active?: boolean
          category: string
          evaluator: string
          id: string
          params: Json
          version: string
        }
        Update: {
          active?: boolean
          category?: string
          evaluator?: string
          id?: string
          params?: Json
          version?: string
        }
        Relationships: []
      }
      ledger: {
        Row: {
          action: string
          actor: Json
          adapter_mode: string
          authority_used: Database["public"]["Enums"]["authority_level"] | null
          evidence_refs: string[]
          hash: string
          object_id: string | null
          object_version: number | null
          occurred_at: string
          payload: Json
          prev_hash: string
          provenance_chain_id: string
          seq: number
          txid: number
        }
        Insert: {
          action: string
          actor: Json
          adapter_mode?: string
          authority_used?: Database["public"]["Enums"]["authority_level"] | null
          evidence_refs?: string[]
          hash: string
          object_id?: string | null
          object_version?: number | null
          occurred_at?: string
          payload: Json
          prev_hash: string
          provenance_chain_id: string
          seq?: number
          txid?: number
        }
        Update: {
          action?: string
          actor?: Json
          adapter_mode?: string
          authority_used?: Database["public"]["Enums"]["authority_level"] | null
          evidence_refs?: string[]
          hash?: string
          object_id?: string | null
          object_version?: number | null
          occurred_at?: string
          payload?: Json
          prev_hash?: string
          provenance_chain_id?: string
          seq?: number
          txid?: number
        }
        Relationships: []
      }
      legacy_aliases: {
        Row: {
          alias: string
          object_id: string
          source_system: string
        }
        Insert: {
          alias: string
          object_id: string
          source_system: string
        }
        Update: {
          alias?: string
          object_id?: string
          source_system?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_aliases_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_initial_states: {
        Row: {
          lifecycle_family: string
          state: string
        }
        Insert: {
          lifecycle_family: string
          state: string
        }
        Update: {
          lifecycle_family?: string
          state?: string
        }
        Relationships: []
      }
      lifecycle_transitions: {
        Row: {
          from_state: string
          lifecycle_family: string
          to_state: string
        }
        Insert: {
          from_state: string
          lifecycle_family: string
          to_state: string
        }
        Update: {
          from_state?: string
          lifecycle_family?: string
          to_state?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: Json
          created_at: string
          decision_id: string | null
          id: string
          recipient_id: string
          trigger_event_id: number | null
        }
        Insert: {
          body: Json
          created_at?: string
          decision_id?: string | null
          id: string
          recipient_id: string
          trigger_event_id?: number | null
        }
        Update: {
          body?: Json
          created_at?: string
          decision_id?: string | null
          id?: string
          recipient_id?: string
          trigger_event_id?: number | null
        }
        Relationships: []
      }
      object_embeddings: {
        Row: {
          embedding: string
          model: string
          object_id: string
        }
        Insert: {
          embedding: string
          model: string
          object_id: string
        }
        Update: {
          embedding?: string
          model?: string
          object_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_embeddings_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: true
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      object_embeddings_restricted: {
        Row: {
          embedding: string
          model: string
          object_id: string
        }
        Insert: {
          embedding: string
          model: string
          object_id: string
        }
        Update: {
          embedding?: string
          model?: string
          object_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_embeddings_restricted_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: true
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      object_type_registry: {
        Row: {
          body_schema: Json
          discovery_descriptor: Json
          family: string
          lifecycle_family: string
          ref_prefix: string
          schema_version: string
          type: string
        }
        Insert: {
          body_schema: Json
          discovery_descriptor: Json
          family: string
          lifecycle_family: string
          ref_prefix: string
          schema_version: string
          type: string
        }
        Update: {
          body_schema?: Json
          discovery_descriptor?: Json
          family?: string
          lifecycle_family?: string
          ref_prefix?: string
          schema_version?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_type_registry_lifecycle_family_fkey"
            columns: ["lifecycle_family"]
            isOneToOne: false
            referencedRelation: "lifecycle_initial_states"
            referencedColumns: ["lifecycle_family"]
          },
        ]
      }
      object_versions: {
        Row: {
          authority_level: Database["public"]["Enums"]["authority_level"]
          body: Json
          builder_id: string | null
          citations: Json
          co_creator_id: string | null
          confidence_bundle: Json | null
          consequence_class: Database["public"]["Enums"]["consequence_class"]
          content_hash: string
          created_at: string
          created_by: Json
          data_classification: Database["public"]["Enums"]["data_classification"]
          derived_from: string[]
          effective_from: string
          evidence_refs: string[]
          expiration_condition: Json
          expires_at: string | null
          human_ref: string
          id: string
          is_tombstone: boolean
          lifecycle_state: string
          machine_description: string
          open_questions: string[]
          owner_id: string
          permission: Json
          permitted_uses: string[]
          provenance_chain_id: string
          retired_at: string | null
          retirement_path: Json
          retirement_reason: string | null
          review_date: string
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          schema_version: string
          search: unknown
          statement: string
          steward_id: string | null
          superseded_by: string[]
          supersedes: string[]
          title: string
          type: string
          updated_at: string
          updated_by: Json
          version: number
        }
        Insert: {
          authority_level?: Database["public"]["Enums"]["authority_level"]
          body?: Json
          builder_id?: string | null
          citations?: Json
          co_creator_id?: string | null
          confidence_bundle?: Json | null
          consequence_class?: Database["public"]["Enums"]["consequence_class"]
          content_hash: string
          created_at?: string
          created_by: Json
          data_classification: Database["public"]["Enums"]["data_classification"]
          derived_from?: string[]
          effective_from?: string
          evidence_refs?: string[]
          expiration_condition: Json
          expires_at?: string | null
          human_ref: string
          id: string
          is_tombstone?: boolean
          lifecycle_state: string
          machine_description: string
          open_questions?: string[]
          owner_id: string
          permission: Json
          permitted_uses?: string[]
          provenance_chain_id: string
          retired_at?: string | null
          retirement_path: Json
          retirement_reason?: string | null
          review_date: string
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          schema_version: string
          search?: unknown
          statement: string
          steward_id?: string | null
          superseded_by?: string[]
          supersedes?: string[]
          title: string
          type: string
          updated_at?: string
          updated_by: Json
          version?: number
        }
        Update: {
          authority_level?: Database["public"]["Enums"]["authority_level"]
          body?: Json
          builder_id?: string | null
          citations?: Json
          co_creator_id?: string | null
          confidence_bundle?: Json | null
          consequence_class?: Database["public"]["Enums"]["consequence_class"]
          content_hash?: string
          created_at?: string
          created_by?: Json
          data_classification?: Database["public"]["Enums"]["data_classification"]
          derived_from?: string[]
          effective_from?: string
          evidence_refs?: string[]
          expiration_condition?: Json
          expires_at?: string | null
          human_ref?: string
          id?: string
          is_tombstone?: boolean
          lifecycle_state?: string
          machine_description?: string
          open_questions?: string[]
          owner_id?: string
          permission?: Json
          permitted_uses?: string[]
          provenance_chain_id?: string
          retired_at?: string | null
          retirement_path?: Json
          retirement_reason?: string | null
          review_date?: string
          risk_tier?: Database["public"]["Enums"]["risk_tier"]
          schema_version?: string
          search?: unknown
          statement?: string
          steward_id?: string | null
          superseded_by?: string[]
          supersedes?: string[]
          title?: string
          type?: string
          updated_at?: string
          updated_by?: Json
          version?: number
        }
        Relationships: []
      }
      objects: {
        Row: {
          authority_level: Database["public"]["Enums"]["authority_level"]
          body: Json
          builder_id: string | null
          citations: Json
          co_creator_id: string | null
          confidence_bundle: Json | null
          consequence_class: Database["public"]["Enums"]["consequence_class"]
          content_hash: string
          created_at: string
          created_by: Json
          data_classification: Database["public"]["Enums"]["data_classification"]
          derived_from: string[]
          effective_from: string
          evidence_refs: string[]
          expiration_condition: Json
          expires_at: string | null
          human_ref: string
          id: string
          is_tombstone: boolean
          lifecycle_state: string
          machine_description: string
          open_questions: string[]
          owner_id: string
          permission: Json
          permitted_uses: string[]
          provenance_chain_id: string
          retired_at: string | null
          retirement_path: Json
          retirement_reason: string | null
          review_date: string
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          schema_version: string
          search: unknown
          statement: string
          steward_id: string | null
          superseded_by: string[]
          supersedes: string[]
          title: string
          type: string
          updated_at: string
          updated_by: Json
          version: number
        }
        Insert: {
          authority_level?: Database["public"]["Enums"]["authority_level"]
          body?: Json
          builder_id?: string | null
          citations?: Json
          co_creator_id?: string | null
          confidence_bundle?: Json | null
          consequence_class?: Database["public"]["Enums"]["consequence_class"]
          content_hash: string
          created_at?: string
          created_by: Json
          data_classification: Database["public"]["Enums"]["data_classification"]
          derived_from?: string[]
          effective_from?: string
          evidence_refs?: string[]
          expiration_condition: Json
          expires_at?: string | null
          human_ref: string
          id: string
          is_tombstone?: boolean
          lifecycle_state: string
          machine_description: string
          open_questions?: string[]
          owner_id: string
          permission: Json
          permitted_uses?: string[]
          provenance_chain_id: string
          retired_at?: string | null
          retirement_path: Json
          retirement_reason?: string | null
          review_date: string
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          schema_version: string
          search?: unknown
          statement: string
          steward_id?: string | null
          superseded_by?: string[]
          supersedes?: string[]
          title: string
          type: string
          updated_at?: string
          updated_by: Json
          version?: number
        }
        Update: {
          authority_level?: Database["public"]["Enums"]["authority_level"]
          body?: Json
          builder_id?: string | null
          citations?: Json
          co_creator_id?: string | null
          confidence_bundle?: Json | null
          consequence_class?: Database["public"]["Enums"]["consequence_class"]
          content_hash?: string
          created_at?: string
          created_by?: Json
          data_classification?: Database["public"]["Enums"]["data_classification"]
          derived_from?: string[]
          effective_from?: string
          evidence_refs?: string[]
          expiration_condition?: Json
          expires_at?: string | null
          human_ref?: string
          id?: string
          is_tombstone?: boolean
          lifecycle_state?: string
          machine_description?: string
          open_questions?: string[]
          owner_id?: string
          permission?: Json
          permitted_uses?: string[]
          provenance_chain_id?: string
          retired_at?: string | null
          retirement_path?: Json
          retirement_reason?: string | null
          review_date?: string
          risk_tier?: Database["public"]["Enums"]["risk_tier"]
          schema_version?: string
          search?: unknown
          statement?: string
          steward_id?: string | null
          superseded_by?: string[]
          supersedes?: string[]
          title?: string
          type?: string
          updated_at?: string
          updated_by?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "objects_type_fkey"
            columns: ["type"]
            isOneToOne: false
            referencedRelation: "object_type_registry"
            referencedColumns: ["type"]
          },
        ]
      }
      ref_sequences: {
        Row: {
          next: number
          prefix: string
          year: number
        }
        Insert: {
          next: number
          prefix: string
          year: number
        }
        Update: {
          next?: number
          prefix?: string
          year?: number
        }
        Relationships: []
      }
      relationship_verbs: {
        Row: {
          directed: boolean
          from_types: string[]
          to_types: string[]
          verb: string
        }
        Insert: {
          directed?: boolean
          from_types: string[]
          to_types: string[]
          verb: string
        }
        Update: {
          directed?: boolean
          from_types?: string[]
          to_types?: string[]
          verb?: string
        }
        Relationships: []
      }
      renditions: {
        Row: {
          body: Json | null
          citations: Json
          expires_at: string
          generated_at: string
          generated_from: Json
          generator: Json
          id: string
          kind: string
          permission_context: Json
          state: string
          storage_path: string | null
        }
        Insert: {
          body?: Json | null
          citations: Json
          expires_at: string
          generated_at?: string
          generated_from: Json
          generator: Json
          id: string
          kind: string
          permission_context: Json
          state?: string
          storage_path?: string | null
        }
        Update: {
          body?: Json | null
          citations?: Json
          expires_at?: string
          generated_at?: string
          generated_from?: Json
          generator?: Json
          id?: string
          kind?: string
          permission_context?: Json
          state?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      reuse_checks: {
        Row: {
          checked_at: string
          checked_by: Json
          decision: string
          id: string
          intent_shape: Json
          query_text: string
          rationale: string
          results: Json
        }
        Insert: {
          checked_at?: string
          checked_by: Json
          decision: string
          id: string
          intent_shape: Json
          query_text: string
          rationale: string
          results: Json
        }
        Update: {
          checked_at?: string
          checked_by?: Json
          decision?: string
          id?: string
          intent_shape?: Json
          query_text?: string
          rationale?: string
          results?: Json
        }
        Relationships: []
      }
      session_events: {
        Row: {
          id: number
          kind: string
          payload: Json
          ref: string | null
          session_id: string
          speaker_id: string | null
          t_offset_ms: number
        }
        Insert: {
          id?: number
          kind: string
          payload: Json
          ref?: string | null
          session_id: string
          speaker_id?: string | null
          t_offset_ms: number
        }
        Update: {
          id?: number
          kind?: string
          payload?: Json
          ref?: string | null
          session_id?: string
          speaker_id?: string | null
          t_offset_ms?: number
        }
        Relationships: []
      }
      tool_contracts: {
        Row: {
          contract: Json
          name: string
          version: string
        }
        Insert: {
          contract: Json
          name: string
          version: string
        }
        Update: {
          contract?: Json
          name?: string
          version?: string
        }
        Relationships: []
      }
      usage_sessions: {
        Row: {
          actor_id: string
          ended_at: string | null
          id: string
          mutating_actions: number
          reads: number
          started_at: string
        }
        Insert: {
          actor_id: string
          ended_at?: string | null
          id: string
          mutating_actions?: number
          reads?: number
          started_at: string
        }
        Update: {
          actor_id?: string
          ended_at?: string | null
          id?: string
          mutating_actions?: number
          reads?: number
          started_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _assert_actor: { Args: { _actor: Json }; Returns: undefined }
      _assert_can_write: {
        Args: {
          _actor: Json
          _o: Database["public"]["Tables"]["objects"]["Row"]
        }
        Returns: undefined
      }
      _ledger_write: {
        Args: {
          _action: string
          _actor: Json
          _chain: string
          _extra: Json
          _o: Database["public"]["Tables"]["objects"]["Row"]
        }
        Returns: undefined
      }
      _load_for_write: {
        Args: { p_actor: Json; p_expected_version: number; p_id: string }
        Returns: {
          authority_level: Database["public"]["Enums"]["authority_level"]
          body: Json
          builder_id: string | null
          citations: Json
          co_creator_id: string | null
          confidence_bundle: Json | null
          consequence_class: Database["public"]["Enums"]["consequence_class"]
          content_hash: string
          created_at: string
          created_by: Json
          data_classification: Database["public"]["Enums"]["data_classification"]
          derived_from: string[]
          effective_from: string
          evidence_refs: string[]
          expiration_condition: Json
          expires_at: string | null
          human_ref: string
          id: string
          is_tombstone: boolean
          lifecycle_state: string
          machine_description: string
          open_questions: string[]
          owner_id: string
          permission: Json
          permitted_uses: string[]
          provenance_chain_id: string
          retired_at: string | null
          retirement_path: Json
          retirement_reason: string | null
          review_date: string
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          schema_version: string
          search: unknown
          statement: string
          steward_id: string | null
          superseded_by: string[]
          supersedes: string[]
          title: string
          type: string
          updated_at: string
          updated_by: Json
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "objects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _thread_apply: {
        Args: {
          _action: string
          _extra: Json
          n: Database["public"]["Tables"]["objects"]["Row"]
          p_actor: Json
        }
        Returns: {
          authority_level: Database["public"]["Enums"]["authority_level"]
          body: Json
          builder_id: string | null
          citations: Json
          co_creator_id: string | null
          confidence_bundle: Json | null
          consequence_class: Database["public"]["Enums"]["consequence_class"]
          content_hash: string
          created_at: string
          created_by: Json
          data_classification: Database["public"]["Enums"]["data_classification"]
          derived_from: string[]
          effective_from: string
          evidence_refs: string[]
          expiration_condition: Json
          expires_at: string | null
          human_ref: string
          id: string
          is_tombstone: boolean
          lifecycle_state: string
          machine_description: string
          open_questions: string[]
          owner_id: string
          permission: Json
          permitted_uses: string[]
          provenance_chain_id: string
          retired_at: string | null
          retirement_path: Json
          retirement_reason: string | null
          review_date: string
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          schema_version: string
          search: unknown
          statement: string
          steward_id: string | null
          superseded_by: string[]
          supersedes: string[]
          title: string
          type: string
          updated_at: string
          updated_by: Json
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "objects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_transition: {
        Args: { _from: string; _to: string; _type: string }
        Returns: undefined
      }
      can_read_object: {
        Args: {
          _cls: Database["public"]["Enums"]["data_classification"]
          _perm: Json
        }
        Returns: boolean
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _uid: string }
        Returns: boolean
      }
      ledger_row_hash: {
        Args: { l: Database["public"]["Tables"]["ledger"]["Row"] }
        Returns: string
      }
      next_human_ref: { Args: { _type: string }; Returns: string }
      object_content_hash: {
        Args: { o: Database["public"]["Tables"]["objects"]["Row"] }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      thread_create_object: {
        Args: { p: Json; p_actor: Json }
        Returns: {
          authority_level: Database["public"]["Enums"]["authority_level"]
          body: Json
          builder_id: string | null
          citations: Json
          co_creator_id: string | null
          confidence_bundle: Json | null
          consequence_class: Database["public"]["Enums"]["consequence_class"]
          content_hash: string
          created_at: string
          created_by: Json
          data_classification: Database["public"]["Enums"]["data_classification"]
          derived_from: string[]
          effective_from: string
          evidence_refs: string[]
          expiration_condition: Json
          expires_at: string | null
          human_ref: string
          id: string
          is_tombstone: boolean
          lifecycle_state: string
          machine_description: string
          open_questions: string[]
          owner_id: string
          permission: Json
          permitted_uses: string[]
          provenance_chain_id: string
          retired_at: string | null
          retirement_path: Json
          retirement_reason: string | null
          review_date: string
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          schema_version: string
          search: unknown
          statement: string
          steward_id: string | null
          superseded_by: string[]
          supersedes: string[]
          title: string
          type: string
          updated_at: string
          updated_by: Json
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "objects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      thread_phase1_selftest: { Args: never; Returns: Json }
      thread_record_phase1_evidence: { Args: { p_actor: Json }; Returns: Json }
      thread_restore_rehearsal: { Args: never; Returns: Json }
      thread_revise_object: {
        Args: {
          p_actor: Json
          p_expected_version: number
          p_id: string
          p_patch: Json
          p_rationale: string
        }
        Returns: {
          authority_level: Database["public"]["Enums"]["authority_level"]
          body: Json
          builder_id: string | null
          citations: Json
          co_creator_id: string | null
          confidence_bundle: Json | null
          consequence_class: Database["public"]["Enums"]["consequence_class"]
          content_hash: string
          created_at: string
          created_by: Json
          data_classification: Database["public"]["Enums"]["data_classification"]
          derived_from: string[]
          effective_from: string
          evidence_refs: string[]
          expiration_condition: Json
          expires_at: string | null
          human_ref: string
          id: string
          is_tombstone: boolean
          lifecycle_state: string
          machine_description: string
          open_questions: string[]
          owner_id: string
          permission: Json
          permitted_uses: string[]
          provenance_chain_id: string
          retired_at: string | null
          retirement_path: Json
          retirement_reason: string | null
          review_date: string
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          schema_version: string
          search: unknown
          statement: string
          steward_id: string | null
          superseded_by: string[]
          supersedes: string[]
          title: string
          type: string
          updated_at: string
          updated_by: Json
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "objects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      thread_tombstone_object: {
        Args: {
          p_actor: Json
          p_expected_version: number
          p_id: string
          p_reason: string
        }
        Returns: {
          authority_level: Database["public"]["Enums"]["authority_level"]
          body: Json
          builder_id: string | null
          citations: Json
          co_creator_id: string | null
          confidence_bundle: Json | null
          consequence_class: Database["public"]["Enums"]["consequence_class"]
          content_hash: string
          created_at: string
          created_by: Json
          data_classification: Database["public"]["Enums"]["data_classification"]
          derived_from: string[]
          effective_from: string
          evidence_refs: string[]
          expiration_condition: Json
          expires_at: string | null
          human_ref: string
          id: string
          is_tombstone: boolean
          lifecycle_state: string
          machine_description: string
          open_questions: string[]
          owner_id: string
          permission: Json
          permitted_uses: string[]
          provenance_chain_id: string
          retired_at: string | null
          retirement_path: Json
          retirement_reason: string | null
          review_date: string
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          schema_version: string
          search: unknown
          statement: string
          steward_id: string | null
          superseded_by: string[]
          supersedes: string[]
          title: string
          type: string
          updated_at: string
          updated_by: Json
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "objects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      thread_transition_object: {
        Args: {
          p_actor: Json
          p_expected_version: number
          p_id: string
          p_rationale: string
          p_to_state: string
        }
        Returns: {
          authority_level: Database["public"]["Enums"]["authority_level"]
          body: Json
          builder_id: string | null
          citations: Json
          co_creator_id: string | null
          confidence_bundle: Json | null
          consequence_class: Database["public"]["Enums"]["consequence_class"]
          content_hash: string
          created_at: string
          created_by: Json
          data_classification: Database["public"]["Enums"]["data_classification"]
          derived_from: string[]
          effective_from: string
          evidence_refs: string[]
          expiration_condition: Json
          expires_at: string | null
          human_ref: string
          id: string
          is_tombstone: boolean
          lifecycle_state: string
          machine_description: string
          open_questions: string[]
          owner_id: string
          permission: Json
          permitted_uses: string[]
          provenance_chain_id: string
          retired_at: string | null
          retirement_path: Json
          retirement_reason: string | null
          review_date: string
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          schema_version: string
          search: unknown
          statement: string
          steward_id: string | null
          superseded_by: string[]
          supersedes: string[]
          title: string
          type: string
          updated_at: string
          updated_by: Json
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "objects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      thread_verify_ledger: { Args: never; Returns: Json }
      uuid_v7: { Args: never; Returns: string }
    }
    Enums: {
      actor_kind: "human" | "agent" | "system"
      app_role: "steward" | "co_creator" | "builder" | "member" | "compliance"
      authority_level:
        | "observe"
        | "recommend"
        | "act_with_confirmation"
        | "act_bounded"
        | "autonomous_with_exception"
      consequence_class:
        | "none"
        | "reversible"
        | "costly_reversible"
        | "irreversible"
        | "rights_affecting"
        | "safety"
        | "lifeline"
      data_classification:
        | "public"
        | "internal"
        | "confidential"
        | "restricted"
        | "prohibited"
      risk_tier: "1" | "2" | "3" | "4"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      actor_kind: ["human", "agent", "system"],
      app_role: ["steward", "co_creator", "builder", "member", "compliance"],
      authority_level: [
        "observe",
        "recommend",
        "act_with_confirmation",
        "act_bounded",
        "autonomous_with_exception",
      ],
      consequence_class: [
        "none",
        "reversible",
        "costly_reversible",
        "irreversible",
        "rights_affecting",
        "safety",
        "lifeline",
      ],
      data_classification: [
        "public",
        "internal",
        "confidential",
        "restricted",
        "prohibited",
      ],
      risk_tier: ["1", "2", "3", "4"],
    },
  },
} as const
