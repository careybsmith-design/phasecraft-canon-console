# Generation layer (Phase 8)

- Generation rules are pure in `src/domain/generation.ts`, mirrored in SQL (`rendition_kinds`, `_prohibited_inference`, `thread_generate_rendition`, `thread_serve_rendition`, `renditions_guard`, `thread_rendition_sweep`, migration 0030); change both together. Renditions are written only by `thread_generate_rendition` and served only by `thread_serve_rendition` to the same identity and purpose. Why: P1 and 14.3 by system.
