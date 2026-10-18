# Correction packet — implementation and exit evidence

**Current recheck:** `docs/THREAD-correction-reaudit.md` supersedes this round's counts and proof where explicitly updated. The new local suite passes 1,735 tests in 32 files; release remains INCOMPLETE. This document preserves the earlier correction-round evidence.

**18 October 2026. Correction-round verdict: INCOMPLETE. No further capability phase authorized.**

The uploaded packet is saved as `docs/THREAD-correction-packet.md` and supersedes its identified source contradictions. A passing local suite is not the packet's definition of done.

## Applied changes and proof

| ID | Changes | Proof and limits |
|---|---|---|
| L-02 | OPEN AW-5 is a non-blocking warning; configured violations block. An owned, non-expiring `AntiWikiActionRatioThresholdUnset` finding is created on setting changes. No default was set. | Domain boundary tests; authenticated aggregate RPC returns `THRESHOLD_UNSET`, `severity=warning`, `release_blocking=false`; finding read back with owner and no expiry. Assurance visibly displays OPEN and both ratios. Current ratios are unmeasured: 0 sessions, action=null, read-only=null. Real usage collection remains incomplete. |
| L-03 | Two-part deferral rule and non-deferrable real pilot gate corrected. Added diarised recorded regression fixture with authority mismatch, whiteboard, contradiction, class/type precision-recall and changed-extractor lifecycle tests. | Four fixture tests pass. This is NOT a database re-extraction/confirmation-preservation execution receipt or real pilot. Real participant names, business condition and scheduled time remain required; deployment target must be recorded with the real session. |
| L-04 | Existing seeds retained; checked-in type/verb/endpoint-group/transition/source/detector manifest added. | Five domain-manifest parity tests pass. Fresh-database migration replay, strict body schemas and every-type/edge insertion remain unverified. |
| L-05 | Domain canonical inventory is 36 blocking-capable keys plus the warning. | Exact count/uniqueness and manifest tests pass. Live database still has 43 rows: six additional legacy controls remain because their writers/findings reference them. Full reconciliation is unfinished; no monitoring/history was deleted to manufacture compliance. |
| L-06 | Span-less candidates discarded before classification/persistence with content-free session events. Normalized extraction_spans populated in the object transaction; deferred insert/update span existence, valid source/range checks and span immutability. Removed JSON-array CHECK as authority. | 26 normalized rows covering 26 existing objects; live scan found 0 relevant non-tombstoned objects missing spans. Nine span-range tests pass. JSON arrays remain deprecated compatibility input/rendering; complete table-only read/write conversion and isolated direct-insert/extractor regression proof remain. |
| L-07 | Preserved existing global advisory-lock serialization and single SQL hash/verifier; documented canonicalization and contention. | Source and live function definitions confirm lock before sequence/head read and shared SQL pgcrypto hash. Concurrent 500 calls/s and tamper-induction exit proof NOT executed. Nightly verifier scheduling remains unverified. |
| L-08 | Governing no-state-ownership rule added to Sections 1/2 and Appendix B; AW-16 added to report and live SQL schema scanner. | AW-16 detects legacy `build_runs.status`; it must FAIL until execution-state ownership is removed safely. BuildRun/CreationPrompt execution lifecycles and status-dependent safety/cost consumers remain unfinished. No rename was used to conceal violation. |
| L-09 | All five controls and targets restored in directives; fail-closed metric helper and signed-in Assurance publication with linked TestRun evidence. | Six tests enforce ≥70% overall and 100% compliance, human-confirmed source refs, blind independent route, mutation sample and cycle review. Metric is caller-permitted and bounded to 1,000 test records, not certified enterprise-wide. Actual independent test authoring, mutation execution, reviewer cycles, source-reference verification and compliance assurance remain incomplete. |
| L-10 | Application table reads revoked, own-row policy removed; window-bounded SECURITY DEFINER aggregate is the only read path. Actor+activity technical-field queries are refused. | Authenticated browser: direct usage_sessions read denied; aggregate succeeds with no actor IDs; `actor_id, reads` request returns actor_activity_fields refusal. Catalog checks: anon/authenticated SELECT=false. |
| L-11 | Shared normalized whole-token guard on lifecycle transitions, initial states, objects and versions. | All existing rows validated; seven benign delegation-style token tests and five forbidden-state tests pass. Isolated direct-object mutant acceptance remains required; lifecycle/provenance legality was not weakened. |
| L-12 | Existing equivalent canon_changes/canon_challenges path preserved and reference design documented. | Patch/evidence/window/counterargument/steward/decision/version fields and existing canon drift function found. Structured/transitive dependent-rendition/capability fan-out proof remains incomplete. |
| L-13 | Section 19 retitled representative. | Complete operation-to-Zod/server-function/MCP binding parity remains unfinished; no catalogue count is treated as executability proof. |
| L-14 | All eight views named. Graph hover isolates incident neighbourhood; inferred edges now thinner/muted and legend accurately describes rendering. | Existing eight-view catalogue, URL-backed state and exports retained. Signed-in exhaustive interaction/keyboard/export acceptance not executed. |
| L-15 | Indexed stored generated simulated columns on current/historical envelopes; first-class model_routes projection, refresh trigger, eligibility gate before live model fetch. | Generated projection reports 79 simulated of 534 objects without rewriting immutable history. Snapshot function updated to omit generated columns. No eligible route rows currently exist: live model calls now fail closed and framing falls back to explicit regression rules. Stored eligibility metadata alone is not trusted attestation verification. |
| L-16 | Pure/persistence separation explicitly corrected in directives. | Existing engine remains pure. Atomic action+PolicyEvaluation+ledger enforcement is still missing and must not be inferred from separate evaluation RPCs. |
| L-17 | All seven graph requirements restored in directives. | Existing server layouts, cluster-first sparse view, budgets and deep links retained. Per-view incremental/LOD completeness and real first-paint/FPS target proof remain open. |
| L-18 | Diagram corrected: pre-session preparation then FramingSession inside burst phases 1–4. | Workflow implementation for full pre-session preparation and phase containment remains incomplete. |
| L-19 | Removed incorrect “verbatim” appendix; regenerated index with exact Appendix C section headings/cross-references. | Full canonical Appendix C retained unchanged; tables/schemas there govern rather than lossy fragments. Part-level binding principles remain governing even where not individually indexed. |
| L-20 | UUID/error adaptations labeled, framing citation corrected, content classifier identified as production deterministic control, P7/P8 mechanisms/routing constraints restored, AGE claim qualified, eight edge sources accepted. | Existing live-edge uniqueness retained. Model tests prove refusal before network on missing eligibility/Tier C. Full provider attestations, scalar/array/JSON lineage validation, recorded-transcription adapter and seven prompt-acceptance tests remain unfinished. |

## Automated and signed-in proof

- Complete local suite: **1,718 tests passed across 31 files**, transcript `docs/audit/correction-suite.txt`.
- Preview compiler's latest checked entry: **build OK**.
- Authenticated `/assurance`: OPEN non-blocking AW-5 warning and real-pilot requirement visible; no page errors.
- Authenticated direct activity read denied; aggregate and prohibited-inference RPC verified.
- Migrations applied: 0065 privacy/warning/state guards, 0066 normalized spans, 0067 model eligibility/edge origins, 0068 simulation projection, 0069 range guard/AW-16 scan. The first attempted mutable simulation backfill was rejected and rolled back; stored generated columns replaced it safely.

## AW-1–AW-16 acceptance, not just local tests

| Check | Verdict | Reason |
|---|---|---|
| AW-1 | BLOCKED | Full live field/semantic/mutation acceptance missing |
| AW-2 | BLOCKED | DB guard corrected; exhaustive authenticated rendered-state scan missing |
| AW-3 | BLOCKED | Complete Mission Runtime OCR acceptance missing |
| AW-4 | BLOCKED | Full API/UI/schema rejected-measure scan missing |
| AW-5 | WARNING — non-blocking | OPEN/THRESHOLD_UNSET; action and read-only ratios null, 0 sessions; no default |
| AW-6 | BLOCKED | Isolated invalid-notification induction missing |
| AW-7 | BLOCKED | Fresh full authorized reuse refusal receipt required |
| AW-8 | BLOCKED | Fresh full uncited-generation refusal receipt required |
| AW-9 | BLOCKED overall | Technical actor-activity refusal verified; exhaustive query/export paths missing |
| AW-10 | BLOCKED | Full static/DB canon-supremacy acceptance missing |
| AW-11 | FAIL | Existing orphan reconciliation remains; no fabricated links or retirement |
| AW-12 | BLOCKED | All-type expiration mutation acceptance missing |
| AW-13 | FAIL | Real adversarial execution harness missing |
| AW-14 | FAIL | Actual published intent-to-first-working-evidence missing |
| AW-15 | BLOCKED | Full native handoff induction/recurrence missing |
| AW-16 | FAIL | Legacy THREAD-owned build status/lifecycles remain |

## What requires Carey / outside parties

1. **Real pilot:** named Co-Creator and Builder, actual business condition, agreed time; record approved enterprise deployment target. Do not supply credentials in chat.
2. **Live model routing:** genuine approved route records with attestation/evaluation evidence, pinned model, permitted tasks/classes and logging-control evidence. No route was auto-cleared.
3. **Independent assurance:** independent author/reviewer, mutation execution evidence, real platform/telemetry/transcription/build/restore/load systems and assessors.
4. **AW-5 decision:** still optional while OPEN; setting it requires Carey's recorded decision, not a fabricated default.

**Engineering is also still unfinished:** legacy detector reconciliation, full normalized provenance conversion, no-state-ownership conversion, action/audit atomicity, operation parity, canon fan-out, complete routing source verification, graph/preparation workflows and dangling-lineage validation. These are not credentials blockers. All are retained in roadmap.md; this round is not declared done.