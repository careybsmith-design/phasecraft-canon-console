# Wave 4 — Stop owning execution state (L-08 / AW-16)

## Problem

`build_runs.status` (`dispatched|running|succeeded|failed`, added in migration 0020) is THREAD-owned execution state. THREAD writes it, transitions the BuildRun object's lifecycle to the platform's status, gates skeleton recording on it, and displays it. L-08 forbids this: platforms own execution; THREAD keeps only source outcomes and read-only mirrors with `mirrored_from`.

## Current consumers (to convert)

- `drizzle/migrations/0020` — `thread_record_build_result` writes `status` and transitions the object lifecycle to the raw platform status; `thread_record_skeleton` gates on `status = 'succeeded'`.
- `src/routes/api/public/hooks/build.$platform.ts` — webhook writes platform status into `build_runs`.
- `src/lib/creation.functions.ts` — dispatch/result surfaces read and display `status`.
- `src/routes/_authenticated/missions.$missionId.tsx` — mission evidence reads `build_runs.*`.
- `src/server/mcp/tools.server.ts` — build-run reads.
- `drizzle/migrations/0060` audit check and `0069` `aw16_state_ownership_scan` — reference `build_runs.status` (the scan correctly fails today).

## Plan

### 1. Migration `0079_build_run_source_outcome.sql` (additive, no drops)

- Add `outcome text check (outcome in ('succeeded','failed','partial'))` and `mirrored_from text` to `public.build_runs`.
- Backfill: `outcome = 'succeeded'/'failed'` where `status` matches; `dispatched`/`running` → NULL (in-flight runs have no outcome yet); `mirrored_from = 'platform_webhook'` where outcome is set.
- `COMMENT ON COLUMN public.build_runs.status IS 'DEPRECATED: THREAD-owned execution state removed per L-08; use outcome + mirrored_from (read-only source mirror). Writes rejected by trigger.'`
- Add trigger `build_runs_status_lock` rejecting any INSERT/UPDATE that sets `status` to anything but its default — the column becomes unwritable, so no code path can re-own execution state.
- Rewrite `thread_record_build_result`: write `outcome` + `mirrored_from` (never `status`); transition the BuildRun object lifecycle to THREAD's own canon state (`evidence_record` family terminal state for a recorded result), not to the platform's status string.
- Rewrite `thread_record_skeleton` to gate on `outcome = 'succeeded'`.
- Update `aw16_state_ownership_scan`: pass when no execution-state columns exist OR the legacy `build_runs.status` column is both DEPRECATED-commented and write-blocked by trigger; fail on any live (writable, non-deprecated) execution-state column. Renaming is not treated as a fix — the scan checks writability, not names.
- Deployment assertions: trigger exists; `thread_record_build_result` body contains no `status =` write.

### 2. Code conversion

- `build.$platform.ts` webhook: accept `outcome` (`succeeded|failed|partial`); pass `mirrored_from` = the platform callback URL; reject payloads that try to set live execution status.
- `creation.functions.ts`: read/display `outcome` + `mirrored_from`; label it "Source outcome (mirrored from platform)" — never as THREAD's own status.
- `missions.$missionId.tsx` and `mcp/tools.server.ts`: same conversion.
- `registry.ts` BuildRun description: "carries only source outcome and lineage; execution state belongs to the platform."

### 3. Tests

- Live DB test: AW-16 scan passes; attempting to write `build_runs.status` raises the trigger exception; recording a result sets `outcome` + `mirrored_from` and leaves `status` at default.
- Unit tests updated for renamed fields; audit-acceptance AW-16 test fed with the passing scan.

### 4. Verify and report

- `bun run verify` (typecheck + lint + full tests), build OK.
- Report: every removed/locked state field, every converted consumer, confirmation no consumer reads THREAD-owned execution status.

## Constraint note

The migration tooling blocks `DROP COLUMN`, so `status` is made unwritable and deprecated rather than dropped — functionally removed (nothing can write or read it), physically present. If you want the column physically dropped, that needs the "Execute backward incompatible database migrations" permission changed in Lovable Cloud settings; say so and I'll do it as a follow-up.
