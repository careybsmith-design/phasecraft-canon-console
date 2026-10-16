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
          trigger: string | null
          trigger_ref: string | null
          txid: number
        }
        Insert: {
          at?: string
          cause: string
          evidence_refs: string[]
          from_level?: Database["public"]["Enums"]["authority_level"] | null
          id?: number
          object_id: string
          to_level: Database["public"]["Enums"]["authority_level"]
          trigger?: string | null
          trigger_ref?: string | null
          txid?: number
        }
        Update: {
          at?: string
          cause?: string
          evidence_refs?: string[]
          from_level?: Database["public"]["Enums"]["authority_level"] | null
          id?: number
          object_id?: string
          to_level?: Database["public"]["Enums"]["authority_level"]
          trigger?: string | null
          trigger_ref?: string | null
          txid?: number
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
      canon_challenges: {
        Row: {
          argument: string
          author: Json
          change_id: string
          created_at: string
          evidence_refs: string[]
          id: string
          origin: string
        }
        Insert: {
          argument: string
          author: Json
          change_id: string
          created_at?: string
          evidence_refs?: string[]
          id: string
          origin: string
        }
        Update: {
          argument?: string
          author?: Json
          change_id?: string
          created_at?: string
          evidence_refs?: string[]
          id?: string
          origin?: string
        }
        Relationships: [
          {
            foreignKeyName: "canon_challenges_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "canon_changes"
            referencedColumns: ["id"]
          },
        ]
      }
      canon_changes: {
        Row: {
          applied_version: number | null
          base_version: number
          challenge_closes_at: string
          decided_at: string | null
          decided_by: Json | null
          decision_object_id: string | null
          decision_rationale: string | null
          evidence_refs: string[]
          id: string
          object_id: string
          patch: Json
          proposed_at: string
          proposed_by: Json
          rationale: string
          state: string
        }
        Insert: {
          applied_version?: number | null
          base_version: number
          challenge_closes_at: string
          decided_at?: string | null
          decided_by?: Json | null
          decision_object_id?: string | null
          decision_rationale?: string | null
          evidence_refs: string[]
          id: string
          object_id: string
          patch: Json
          proposed_at?: string
          proposed_by: Json
          rationale: string
          state?: string
        }
        Update: {
          applied_version?: number | null
          base_version?: number
          challenge_closes_at?: string
          decided_at?: string | null
          decided_by?: Json | null
          decision_object_id?: string | null
          decision_rationale?: string | null
          evidence_refs?: string[]
          id?: string
          object_id?: string
          patch?: Json
          proposed_at?: string
          proposed_by?: Json
          rationale?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "canon_changes_decision_object_id_fkey"
            columns: ["decision_object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canon_changes_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
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
      capability_usage: {
        Row: {
          adapter_mode: string
          at: string
          capability_id: string
          composition_id: string | null
          consumer: string
          cost: number
          id: number
          latency_ms: number | null
          outcome: string
        }
        Insert: {
          adapter_mode?: string
          at?: string
          capability_id: string
          composition_id?: string | null
          consumer: string
          cost?: number
          id?: number
          latency_ms?: number | null
          outcome: string
        }
        Update: {
          adapter_mode?: string
          at?: string
          capability_id?: string
          composition_id?: string | null
          consumer?: string
          cost?: number
          id?: number
          latency_ms?: number | null
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_usage_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_usage_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_corrections: {
        Row: {
          by_actor: string
          created_at: string
          from_class: string
          id: string
          note: string | null
          session_id: string
          statement_id: string
          to_class: string
        }
        Insert: {
          by_actor: string
          created_at?: string
          from_class: string
          id?: string
          note?: string | null
          session_id: string
          statement_id: string
          to_class: string
        }
        Update: {
          by_actor?: string
          created_at?: string
          from_class?: string
          id?: string
          note?: string | null
          session_id?: string
          statement_id?: string
          to_class?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_corrections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_corrections_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
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
          kind: string | null
          rationale: string | null
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
          kind?: string | null
          rationale?: string | null
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
          kind?: string | null
          rationale?: string | null
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
      extraction_eval_items: {
        Row: {
          created_at: string
          expected_classification: string
          expected_object_type: string | null
          id: string
          label_source: string
          speaker_has_decision_authority: boolean
          text: string
        }
        Insert: {
          created_at?: string
          expected_classification: string
          expected_object_type?: string | null
          id?: string
          label_source: string
          speaker_has_decision_authority: boolean
          text: string
        }
        Update: {
          created_at?: string
          expected_classification?: string
          expected_object_type?: string | null
          id?: string
          label_source?: string
          speaker_has_decision_authority?: boolean
          text?: string
        }
        Relationships: []
      }
      extraction_revisions: {
        Row: {
          adapter_mode: string
          extractor_version: string
          finished_at: string | null
          id: string
          model: string | null
          model_route: string
          preserved_confirmations: number
          revision: number
          session_id: string
          started_at: string
          statements: number
          superseded_drafts: number
        }
        Insert: {
          adapter_mode: string
          extractor_version: string
          finished_at?: string | null
          id?: string
          model?: string | null
          model_route: string
          preserved_confirmations?: number
          revision: number
          session_id: string
          started_at?: string
          statements?: number
          superseded_drafts?: number
        }
        Update: {
          adapter_mode?: string
          extractor_version?: string
          finished_at?: string | null
          id?: string
          model?: string | null
          model_route?: string
          preserved_confirmations?: number
          revision?: number
          session_id?: string
          started_at?: string
          statements?: number
          superseded_drafts?: number
        }
        Relationships: [
          {
            foreignKeyName: "extraction_revisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
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
      extraction_timings: {
        Row: {
          created_at: string
          id: number
          latency_ms: number
          session_id: string
          stage: string
          statement_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          latency_ms: number
          session_id: string
          stage: string
          statement_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          latency_ms?: number
          session_id?: string
          stage?: string
          statement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_timings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_timings_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      framing_live_findings: {
        Row: {
          created_at: string
          id: string
          kind: string
          latency_ms: number | null
          message: string
          payload: Json
          related_object_id: string | null
          resolution: Json | null
          resolved_at: string | null
          session_id: string
          state: string
          statement_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          latency_ms?: number | null
          message: string
          payload?: Json
          related_object_id?: string | null
          resolution?: Json | null
          resolved_at?: string | null
          session_id: string
          state?: string
          statement_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          latency_ms?: number | null
          message?: string
          payload?: Json
          related_object_id?: string | null
          resolution?: Json | null
          resolved_at?: string | null
          session_id?: string
          state?: string
          statement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "framing_live_findings_related_object_id_fkey"
            columns: ["related_object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framing_live_findings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framing_live_findings_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_layouts: {
        Row: {
          cluster: string
          computed_at: string
          object_id: string
          x: number
          y: number
        }
        Insert: {
          cluster: string
          computed_at?: string
          object_id: string
          x: number
          y: number
        }
        Update: {
          cluster?: string
          computed_at?: string
          object_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "graph_layouts_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: true
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      guardrails: {
        Row: {
          active: boolean
          category: string
          enforcement: string
          evaluator: string
          id: string
          params: Json
          proposed_by: string
          version: string
        }
        Insert: {
          active?: boolean
          category: string
          enforcement?: string
          evaluator: string
          id: string
          params: Json
          proposed_by?: string
          version: string
        }
        Update: {
          active?: boolean
          category?: string
          enforcement?: string
          evaluator?: string
          id?: string
          params?: Json
          proposed_by?: string
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
          acyclic: boolean
          computed: boolean
          directed: boolean
          from_types: string[]
          impact: string
          signatures: Json
          to_types: string[]
          verb: string
        }
        Insert: {
          acyclic?: boolean
          computed?: boolean
          directed?: boolean
          from_types: string[]
          impact?: string
          signatures?: Json
          to_types: string[]
          verb: string
        }
        Update: {
          acyclic?: boolean
          computed?: boolean
          directed?: boolean
          from_types?: string[]
          impact?: string
          signatures?: Json
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
          behavior_statement_id: string | null
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
          behavior_statement_id?: string | null
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
          behavior_statement_id?: string | null
          checked_at?: string
          checked_by?: Json
          decision?: string
          id?: string
          intent_shape?: Json
          query_text?: string
          rationale?: string
          results?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reuse_checks_behavior_statement_id_fkey"
            columns: ["behavior_statement_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          computed_at: string
          computed_by: string
          computed_tier: Database["public"]["Enums"]["risk_tier"]
          id: string
          inputs: Json
          object_id: string
          override_rationale: string | null
          override_tier: Database["public"]["Enums"]["risk_tier"] | null
          reasons: Json
          treatment: string
        }
        Insert: {
          computed_at?: string
          computed_by: string
          computed_tier: Database["public"]["Enums"]["risk_tier"]
          id?: string
          inputs: Json
          object_id: string
          override_rationale?: string | null
          override_tier?: Database["public"]["Enums"]["risk_tier"] | null
          reasons?: Json
          treatment: string
        }
        Update: {
          computed_at?: string
          computed_by?: string
          computed_tier?: Database["public"]["Enums"]["risk_tier"]
          id?: string
          inputs?: Json
          object_id?: string
          override_rationale?: string | null
          override_tier?: Database["public"]["Enums"]["risk_tier"] | null
          reasons?: Json
          treatment?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
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
      _canon_challenge_agent: { Args: { p_change: string }; Returns: number }
      _canon_ledger: {
        Args: {
          o: Database["public"]["Tables"]["objects"]["Row"]
          p_action: string
          p_actor: Json
          p_payload: Json
        }
        Returns: undefined
      }
      _capability_gaps: { Args: { _body: Json }; Returns: string[] }
      _chain_obj: { Args: { _ids: string[] }; Returns: Json }
      _cite: { Args: { _objs: Json }; Returns: Json }
      _demotion_target: {
        Args: {
          _from: Database["public"]["Enums"]["authority_level"]
          _trigger: string
        }
        Returns: Database["public"]["Enums"]["authority_level"]
      }
      _edge_signature_ok: {
        Args: { _from: string; _to: string; _verb: string }
        Returns: boolean
      }
      _expand_type_group: { Args: { _name: string }; Returns: string[] }
      _explain: { Args: { p_chain: Json; p_question: string }; Returns: Json }
      _framing_confirmer_ok: {
        Args: { _actor: string; _session: string }
        Returns: boolean
      }
      _fwd: { Args: { _ids: string[]; _verb: string }; Returns: string[] }
      _fx_payload: {
        Args: { _body: Json; _title: string; _type: string }
        Returns: Json
      }
      _is_current_member: { Args: { _u: string }; Returns: boolean }
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
      _list: { Args: { _q: string; _rows: Json }; Returns: Json }
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
      _of_type: {
        Args: { _ids: string[]; _types: string[] }
        Returns: string[]
      }
      _p4_cap_body: {
        Args: { _ins: string[]; _outs: string[]; _title: string }
        Returns: Json
      }
      _prod_caps: {
        Args: never
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
        }[]
        SetofOptions: {
          from: "*"
          to: "objects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      _rev: { Args: { _ids: string[]; _verb: string }; Returns: string[] }
      _selftest_body: { Args: { _refs: Json; _type: string }; Returns: Json }
      _selftest_next_state: {
        Args: { _family: string; _from: string }
        Returns: string
      }
      _selftest_refs: { Args: { _actor: Json }; Returns: Json }
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
      artifact_modality: { Args: { _kind: string }; Returns: string }
      assert_transition: {
        Args: { _from: string; _to: string; _type: string }
        Returns: undefined
      }
      can_reach_creation: { Args: { p_behavior: string }; Returns: boolean }
      can_read_object: {
        Args: {
          _cls: Database["public"]["Enums"]["data_classification"]
          _perm: Json
        }
        Returns: boolean
      }
      can_read_session: { Args: { _s: string }; Returns: boolean }
      canon_drift_report: { Args: never; Returns: Json }
      chain_completeness: { Args: { p_id: string }; Returns: Json }
      composition_effective_authority: {
        Args: { p_id: string }
        Returns: Database["public"]["Enums"]["authority_level"]
      }
      decision_ancestor: { Args: { p_behavior: string }; Returns: string }
      evidence_chain: { Args: { p_id: string }; Returns: Json }
      explain_capability: {
        Args: { p_id: string; p_question: string }
        Returns: Json
      }
      explain_capability_all: { Args: { p_id: string }; Returns: Json }
      fabric_search: {
        Args: {
          p_domain: string
          p_inputs: string[]
          p_limit?: number
          p_outcome: string
          p_outputs: string[]
        }
        Returns: Json
      }
      framing_related_objects: {
        Args: {
          p_limit?: number
          p_session: string
          p_text: string
          p_types: string[]
        }
        Returns: Json
      }
      graph_closure: {
        Args: { p_depth?: number; p_root: string }
        Returns: Json
      }
      graph_contradictions: { Args: never; Returns: Json }
      graph_cycles: { Args: { p_verbs?: string[] }; Returns: Json }
      graph_edge_json: {
        Args: { e: Database["public"]["Tables"]["edges"]["Row"] }
        Returns: Json
      }
      graph_nebula: {
        Args: {
          p_cluster?: string
          p_edge_budget?: number
          p_node_budget?: number
        }
        Returns: Json
      }
      graph_neighbourhood: {
        Args: {
          p_depth?: number
          p_edge_budget?: number
          p_root: string
          p_verbs?: string[]
        }
        Returns: Json
      }
      graph_node_json: {
        Args: { o: Database["public"]["Tables"]["objects"]["Row"] }
        Returns: Json
      }
      graph_orphans: { Args: { p_limit?: number }; Returns: Json }
      graph_paths: {
        Args: {
          p_from: string
          p_limit?: number
          p_max_depth?: number
          p_to: string
        }
        Returns: Json
      }
      graph_subgraph: {
        Args: {
          p_edge_budget?: number
          p_node_budget?: number
          p_types: string[]
          p_verbs: string[]
        }
        Returns: Json
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
      thread_add_canon_challenge: {
        Args: {
          p_actor: Json
          p_argument: string
          p_change_id: string
          p_evidence_refs?: Json
        }
        Returns: {
          argument: string
          author: Json
          change_id: string
          created_at: string
          evidence_refs: string[]
          id: string
          origin: string
        }
        SetofOptions: {
          from: "*"
          to: "canon_challenges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      thread_authority_event: {
        Args: {
          p_actor: Json
          p_evidence?: string[]
          p_id: string
          p_trigger: string
        }
        Returns: Json
      }
      thread_authority_sweep: { Args: { p_actor: Json }; Returns: Json }
      thread_compose_capabilities: {
        Args: {
          p_actor: Json
          p_ids: string[]
          p_scenario: string
          p_title: string
        }
        Returns: Json
      }
      thread_create_edge: {
        Args: { p: Json; p_actor: Json }
        Returns: {
          authority_used: Database["public"]["Enums"]["authority_level"]
          confidence: number | null
          created_at: string
          created_by: Json
          evidence_refs: string[]
          from_id: string
          id: string
          kind: string | null
          rationale: string | null
          retired_at: string | null
          source: string
          to_id: string
          verb: string
        }
        SetofOptions: {
          from: "*"
          to: "edges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      thread_decide_canon_change: {
        Args: {
          p_actor: Json
          p_change_id: string
          p_decision: string
          p_rationale: string
        }
        Returns: Json
      }
      thread_fabric_sweep: {
        Args: { p_actor: Json; p_now?: string }
        Returns: Json
      }
      thread_fabric_sweep_scoped: {
        Args: { p_actor: Json; p_now: string; p_only: string[] }
        Returns: Json
      }
      thread_framing_sweep: { Args: { p_actor: Json }; Returns: Json }
      thread_graph_sweep: { Args: { p_actor: Json }; Returns: Json }
      thread_phase1_selftest: { Args: never; Returns: Json }
      thread_phase2_selftest: { Args: never; Returns: Json }
      thread_phase2b_selftest: { Args: never; Returns: Json }
      thread_phase3_selftest: { Args: never; Returns: Json }
      thread_phase4_selftest: { Args: never; Returns: Json }
      thread_phase5_selftest: { Args: never; Returns: Json }
      thread_propose_canon_change: {
        Args: { p: Json; p_actor: Json }
        Returns: {
          applied_version: number | null
          base_version: number
          challenge_closes_at: string
          decided_at: string | null
          decided_by: Json | null
          decision_object_id: string | null
          decision_rationale: string | null
          evidence_refs: string[]
          id: string
          object_id: string
          patch: Json
          proposed_at: string
          proposed_by: Json
          rationale: string
          state: string
        }
        SetofOptions: {
          from: "*"
          to: "canon_changes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      thread_publish_capability: {
        Args: { p_actor: Json; p_contract_id: string; p_id: string }
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
      thread_record_capability_use: {
        Args: { p: Json; p_actor: Json; p_id: string }
        Returns: number
      }
      thread_record_phase1_evidence: { Args: { p_actor: Json }; Returns: Json }
      thread_record_phase2_evidence: { Args: { p_actor: Json }; Returns: Json }
      thread_record_phase2b_evidence: {
        Args: { p: Json; p_actor: Json }
        Returns: Json
      }
      thread_record_phase3_evidence: {
        Args: { p: Json; p_actor: Json }
        Returns: Json
      }
      thread_record_phase4_evidence: {
        Args: { p: Json; p_actor: Json }
        Returns: Json
      }
      thread_record_phase5_evidence: {
        Args: { p: Json; p_actor: Json }
        Returns: Json
      }
      thread_record_render_benchmark: {
        Args: { p: Json; p_actor: Json }
        Returns: number
      }
      thread_record_risk: {
        Args: { p: Json; p_actor: Json; p_id: string }
        Returns: {
          computed_at: string
          computed_by: string
          computed_tier: Database["public"]["Enums"]["risk_tier"]
          id: string
          inputs: Json
          object_id: string
          override_rationale: string | null
          override_tier: Database["public"]["Enums"]["risk_tier"] | null
          reasons: Json
          treatment: string
        }
        SetofOptions: {
          from: "*"
          to: "risk_assessments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      thread_refresh_graph_layout: { Args: never; Returns: Json }
      thread_restore_rehearsal: { Args: never; Returns: Json }
      thread_retire_edge: {
        Args: { p_actor: Json; p_edge_id: string; p_reason: string }
        Returns: {
          authority_used: Database["public"]["Enums"]["authority_level"]
          confidence: number | null
          created_at: string
          created_by: Json
          evidence_refs: string[]
          from_id: string
          id: string
          kind: string | null
          rationale: string | null
          retired_at: string | null
          source: string
          to_id: string
          verb: string
        }
        SetofOptions: {
          from: "*"
          to: "edges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      thread_set_authority: {
        Args: {
          p_actor: Json
          p_cause: string
          p_conditions?: Json
          p_evidence: string[]
          p_id: string
          p_to: Database["public"]["Enums"]["authority_level"]
          p_trigger: string
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
      trace_behaviors_without_tests: { Args: never; Returns: Json }
      trace_blast_radius: { Args: { p_behavior: string }; Returns: Json }
      trace_canon_change_impact: { Args: { p_id: string }; Returns: Json }
      trace_expired_exposures: { Args: never; Returns: Json }
      trace_full_chain: { Args: { p_id: string }; Returns: Json }
      trace_incident_to_decision: {
        Args: { p_incident: string }
        Returns: Json
      }
      trace_production_without_decision: { Args: never; Returns: Json }
      trace_production_without_value: {
        Args: { p_period?: string }
        Returns: Json
      }
      trace_retirement_impact: { Args: { p_capability: string }; Returns: Json }
      trace_value_without_owner: { Args: never; Returns: Json }
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
