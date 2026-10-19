# THREAD — Correction Packet for the Lovable Build Prompt

**Prepared for:** Carey Smith, COO, MASA Global
**Date:** 16 October 2026
**Subject:** `THREAD-Lovable-Build-Prompt.md` (Lovable, 15 October 2026) reviewed against _THREAD Build Plan, ValueOS-Native Edition, Revision 1.1_
**Verdict:** Structurally sound and faithful in intent. The canonical layer (Appendix C) is complete and correctly reproduced. The defects are concentrated in **Layer A** (the operational directives Lovable actually builds from) and in the **DDL**, plus one internal contradiction that would permanently block release.
**Environment:** MASA builds on this Lovable enterprise workspace under CEO approval. The platform and all content migrate to MASA's own AWS environment later; nothing in this packet constrains what may run here in the interim.

---

## How to use this packet

This document is written **to be pasted into Lovable as-is**.

- **Part 1 — Blocking corrections.** Apply before continuing. Three items; each would produce a wrong or perpetually-failing system.
- **Part 2 — Incorrections.** Statements in the prompt that are wrong or contradict the source.
- **Part 3 — Omissions.** Required content that is absent.
- **Parts 4–5 — Gaps in the source plan and non-blocking edits.**
- **Part 6 — Definition of done** for this correction round.

Cite the directive id (L-02 … ) when reporting completion, and produce the exit evidence named with each one.

---

## Summary of findings

| ID       | Sev         | Location                  | Issue                                                                                                                                                                                                                                     |
| -------- | ----------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L-02** | **Blocker** | §17 vs App. B (line 1149) | AW-5 is unsatisfiable while its threshold is OPEN, but §17 makes any AW failure a release blocker. No release can ever pass.                                                                                                              |
| **L-03** | **Blocker** | §16 (line 293)            | `pending_live_adapter` extends to "a real framing session", letting Phase 2B complete with zero real human sessions — defeating the purpose of the phase.                                                                                 |
| **L-04** | **Blocker** | §18                       | No seed migration for `object_type_registry`, `relationship_verbs` or `lifecycle_transitions`. All three are FK targets; nothing can be inserted until they are populated.                                                                |
| **L-05** | High        | §16 (line 287)            | Detector inventory is ambiguous and will produce 67 duplicate/conflicting detectors where 36 distinct ones exist.                                                                                                                         |
| **L-06** | High        | §6 vs §18                 | Two contradictory mechanisms specified for provenance spans (an array with a CHECK constraint vs a separate table with a trigger). A CHECK cannot constrain another table.                                                                |
| **L-07** | High        | §3.3 vs §18 (line 520)    | Hash-chained ledger has no append serialisation; will fork under concurrency and the verifier will disagree with the writer over canonical JSON.                                                                                          |
| **L-08** | High        | §2.1, §3.2                | The governing rule "the platforms own execution; THREAD owns the thread" never reaches Layer A. Nothing prevents a builder from adding build/environment state to THREAD — i.e. rebuilding the STATE — and no acceptance test catches it. |
| **L-09** | High        | §17 (line 299)            | Part 21.3 verification independence is reduced to one control and its published targets (≥70% overall, 100% compliance-scoped) are dropped.                                                                                               |
| **L-10** | High        | §18 (line 508)            | `usage_sessions(actor_id, mutating_actions, reads)` is precisely the per-person activity store Part 14.3 prohibits. No access restriction, no detector coverage, no rule against surfacing it.                                            |
| **L-11** | Medium      | §18 (line 353)            | `no_approval_states` regex is over-broad (`gate` matches _delegate_, _aggregate_, _investigate_) and applies only to `lifecycle_transitions`, not to `objects.lifecycle_state`.                                                           |
| **L-12** | Medium      | §18, §19, §12             | No storage or object type for `ChallengeRef` / canon-change proposals, although the envelope, P15, §19, Part 11.11 and §12 all require them.                                                                                              |
| **L-13** | Medium      | §19                       | ~36 of ~90 required operations presented as "the API surface", with whole groups absent.                                                                                                                                                  |
| **L-14** | Medium      | §6 (line 189)             | Framing views miscounted — "the other two views" when there are three; one of eight is silently dropped.                                                                                                                                  |
| **L-15** | Medium      | §18                       | Deterministic gates (`simulated`, `attestation_expiry`) live in `jsonb`, unindexed, eating the performance budget and making the gates fragile.                                                                                           |
| **L-16** | Medium      | §5                        | Authority engine described as pure _and_ as writing objects and ledger entries.                                                                                                                                                           |
| **L-17** | Medium      | §15                       | Part 16.5's graph rendering strategy compressed to two words; server-side layouts, LOD, incremental loading and sparsity-by-default dropped.                                                                                              |
| **L-18** | Medium      | §3.2                      | FramingSession placed _after_ ValueBurst; the source puts it _inside_ burst phases 1–4 as the front of the loop.                                                                                                                          |
| **L-19** | Medium      | App. A                    | Appendix A is labelled "verbatim" but is a mangled extraction: scrambled table fragments, heading-only entries, and wrong section labels.                                                                                                 |
| **L-20** | Low         | various                   | Undisclosed inventions (UUIDv7, error model); mis-citations; unverified third-party claims; missing P7/P8 mechanisms; asset vocabulary drift.                                                                                             |

---

## Part 1 — Blocking corrections

### L-02. Make AW-5 non-blocking while its threshold is OPEN

**Problem.** §17 states: _"Every release must pass them, and a regression is a release blocker."_ Appendix B states AW-5 _"reports the measured ratios and fails with `THRESHOLD_UNSET`"_ while `canon_settings('anti_wiki.action_ratio')` has `status = 'open'`. These cannot both hold. As written, **no release can ever pass**, and a builder will resolve the contradiction in whichever direction is convenient — most likely by disabling AW-5, which removes the single most important behavioural test in the document.

**Directive.**

1. Change Appendix B's clause to:

   > While `status = 'open'`, AW-5 **computes and reports** both ratios and raises a WARNING-level `DetectorFinding` (`AntiWikiActionRatioThresholdUnset`). It does **not** block release. The failure state `THRESHOLD_UNSET` is reported in the test output and in the slice-end report to Carey, never swallowed. Blocking begins the moment a value is set: thereafter any ratio outside the threshold is a release blocker and a regression.

2. Add `AntiWikiActionRatioThresholdUnset` to the detector inventory (L-05) with an owner and no expiry.

3. Every slice-end report to Carey must print the current measured ratios and the OPEN status of the threshold until it is set.

**Exit evidence.** A run with `status='open'` completes with a warning and a finding, not a failure; a run with a value set fails correctly when the ratio is outside it.

### L-03. Separate adapter-dependent evidence from the Phase 2B human pilot

**Problem.** Part 20's Phase 2B exit evidence is the highest-risk unknown the phase exists to front-load: a **real** framing session between a Business Co-Creator and a Builder, with 100% provenance coverage, a deliberate non-authority remark caught, a live cross-session contradiction detected, and re-extraction preserving confirmations. §16's blanket rule — _"Exit evidence that depends on real external systems (live builds on five platforms, **a real framing session**, a penetration test, DR timing) is recorded as `pending_live_adapter`"_ — makes all of that deferrable. Phase 3 would then be built against fixtures, which is exactly what the source's design decision says not to do.

**Directive.**

1. Replace the §16 clause with a two-part rule:

   > **(a) Adapter-dependent evidence may be deferred.** Live builds on the five platforms, the live telemetry tap, live feature-flag exposure, penetration testing and DR timing are recorded as `pending_live_adapter` with simulated evidence attached, and count as met only when the live adapter produces it. List them at the end of every slice.
   >
   > **(b) The Phase 2B human pilot may NOT be deferred.** A real framing session with real human participants is required exit evidence, not an adapter dependency. **Phase 3 must not begin until it passes**, including: 100% provenance coverage across the produced object set; a deliberate offhand remark by a participant without decision authority classified as a `suggestion` with the mismatch surfaced in-session; a deliberate contradiction with a prior confirmed object detected live; re-extraction with a changed extractor preserving every prior confirmation; and a draft object proven unable to reach creation. Precision and recall must be published per classification and per object type.

2. Add, as a named decision recorded in Appendix B:

   > **DESIGN DECISION (recorded).** The Phase 2B pilot runs in this environment, against a real business condition and real participants, on the enterprise account MASA holds here. Because the platform and its content migrate to MASA's AWS environment later, the pilot is executed on the same codebase that will move, and the deployment target is recorded with the session. A synthetic or recorded session is a regression fixture, never a substitute for the pilot.

3. Add a synthetic framing-session fixture set: at least one complete session with diarised speaker labels, authority assignments, a whiteboard, an in-session contradiction and a re-extraction revision — sufficient to exercise every Phase 2B exit criterion mechanically.

**Exit evidence.** The two-part rule is present; the fixture set exists and exercises all Phase 2B criteria; the real pilot is scheduled and its deployment target is recorded.

### L-04. Seed the three registry tables, or nothing can be inserted

**Problem.** §18 declares `objects.type text not null references public.object_type_registry(type)` and `edges.verb text not null references public.relationship_verbs(verb)`, and §18's `assert_transition` trigger reads `lifecycle_transitions`. §18 contains **no INSERT statements** for any of the three, and §4 never instructs you to produce them. As written, the first object insert fails on a foreign key and the state machine permits nothing. This is not a nicety — the platform is inert.

**Directive.**

1. Produce a **seed migration** (`seed_registry`) containing:

   **(a) Every object type** from Part 4.3 families A–L, plus Part 8A.6 (`FramingSession`, `CoCreationArtifact`, `ExtractedStatement`, `NeedStatement`) and the other types named in Part 8A.4 (`DependencyProposal`, `EvidenceRequirement`, `EvidenceRef`). For each: `type`, `family`, `ref_prefix`, `lifecycle_family`, `body_schema` (JSON Schema), `discovery_descriptor`, `schema_version`.

   **(b) Every relationship verb** from Part 4.2 and Part 8A.7.2, with `from_types` and `to_types` arrays.

   **(c) Every lifecycle transition** from Part 4.4, one row per legal `from_state → to_state` per `lifecycle_family`.

   **(d) The canonical detector inventory** — exactly the 36 keys in L-05.

   **(e) The six guardrail categories** from Part 6.6 as `guardrails` rows, each with its evaluator key registered in TypeScript.

   **(f) `canon_settings` keys**, including `anti_wiki.action_ratio` with `status = 'open'` and no value.

2. **Types that are referenced but not registered in §4.3 must be resolved explicitly.** At minimum: `ChallengeRef`, `AuthorityGrant`, `PermissionSpec`, `Citation`, `Actor`, `Persona`, `Situation`, `MissionContract`, `GuardrailSet`, `WorkingCapability`, `EvidenceBundleRef`, `AuthorityRef`, `ExposurePopulation`, `ProviderAttestation`, `ModelRoute`, `EvaluationSuite`. For each, decide whether it is an **embedded value object** inside the envelope/body or a **registered object type**, record the decision as a DESIGN DECISION, and never leave it ambiguous. Anything referenced by an edge verb's `from_types`/`to_types` must be registered.

3. Add a **registry completeness test**: the seeded registry, verb table and transition table are compared against a checked-in manifest file, and any drift fails the build. A type may not be inserted at runtime, and a `relationship_verbs` row may not be added without updating the manifest.

**Exit evidence.** A fresh migration creates a working database; one object of every registered type can be inserted with its edges; the completeness test passes; the manifest is checked in.

---

## Part 2 — Incorrections

### L-05. Fix the detector inventory: 36 distinct detectors, not 67

**Problem.** §16 Phase 10 (line 287) reads: _"the 15 ValueOS failure-mode detectors, the THREAD-specific detectors and the 16 framing detectors."_ In the source, Part 1.3.11 lists the fifteen failure modes as prose, and Part 11.9's table then **re-lists those same fifteen** as named keys before adding five more. A builder applying §16 literally builds 15 + 36 + 16 = **67 detectors**, many of them duplicates with divergent definitions — which is the named failure mode _"multiple agents with conflicting definitions"_, applied to detection.

**Directive.** Replace the Phase 10 clause and §17's "one test per detector" with the canonical inventory below. Exactly **36** detectors. No aliases, no duplicates, no second detector for the same signal under a different name. Each has `key`, `family`, `owner_id`, `schedule`, `event_triggers`, `params`, `version`; each has one inducing test that asserts a finding **with an owner assigned**.

**Group 1 — the fifteen ValueOS failure modes (Part 1.3.11 → Part 11.9 keys), 15:**

```
RequestedSolutionWithoutCondition
MissionWithoutEmpoweredCoCreator
DocumentPreparedForHandoff
AwarenessOnlyRecurringMeeting
StandardWorkAwaitingApproval
CapabilityCreatedWithoutRegistrySearch
BatchThatCouldBeIncremental
HumanMonitoringMachinesCouldPerform
AutonomousActionWithoutEvidence
CapabilityWithoutOwnerTelemetryOrExpiration
LocalScopeOverEnterpriseValue
BuilderPerformingAgentWork
UncitableGeneratedAnswer
HighImpactToolCallWithoutPolicy
ValueFeedDriftingTowardEngagement
```

**Group 2 — THREAD governance and measurement frames, 5:**

```
CanonFragmentation
ScopeChangeClassifiedAsCosmetic
RejectedMeasureInUse
WikiDrift
AuthorityInflation
```

**Group 3 — framing pipeline (Part 8A.12), 16:**

```
RawSpeechTreatedAsAuthority
UnextractedDecision
BehaviorWithoutNeed
NeedWithoutBehavior
NeedWithoutMeasure
UnextractedSession
SessionWithoutConsent
ContradictionUnresolved
AssumptionUnverified
ProvenanceSpanMissing
DraftObjectUsedAsBasis
DraftCountedAsProgress
SessionProducingMinutes
DependencyCycle
InferredEdgeAutoConfirmed
FramingSessionAsMeeting
```

Plus `AntiWikiActionRatioThresholdUnset` from L-02 (WARNING-level, no blocking) → **37 rows total, 36 blocking-capable.**

**Exit evidence.** `detectors` contains exactly the manifest; a test fails if a key is added, removed or duplicated; every detector has an owner and a passing inducing test.

### L-06. One mechanism for provenance spans — the table, not an array

**Problem.** §6 says: _"Every extracted object stores `provenance_spans[] = {artifact_id|segment_id, start, end, speaker_id}`. A CHECK constraint rejects an empty spans array."_ §18 instead puts spans in a separate `extraction_spans` table and enforces via a trigger that an extracted object cannot leave `draft` without a span. A CHECK constraint cannot constrain rows in another table, so one of the two is unimplementable as written. Worse, both are weaker than the source requirement: Part 8A.4 says _"An extracted object with no provenance span is **discarded before it reaches the graph** — not flagged, discarded."_

**Directive.**

1. **Keep the `extraction_spans` table.** A span is per source artifact, with speaker, timestamp range, character range, drawing region or interaction-log offset — it is not a scalar on the object. Delete the `provenance_spans[]` array and the "CHECK constraint rejects an empty spans array" wording from §6.

2. Enforce the real rule in three places:
   - **At extraction:** the extractor drops any candidate object with no span before persistence. This is the primary control and must be a unit test.
   - **At insert:** a trigger on `objects` rejects any insert whose `type` is in the Framing family and which has no `extraction_spans` row in the same transaction. This replaces the weaker `draft_cannot_reach_creation`-only approach as the guard for the non-negotiable.
   - **At draft exit:** keep the existing trigger as a second line.

3. Add `ProvenanceSpanMissing` as the monitor for bypass, as the source specifies — it should read zero.

**Exit evidence.** A candidate object with no span is discarded, not persisted, and the attempt is observable; a direct insert attempt is rejected by the trigger; `ProvenanceSpanMissing` reads zero.

### L-07. Make the ledger chain safe under concurrency

**Problem.** §18 specifies: _"BEFORE trigger computes `hash = sha256(prev_hash ‖ canonical_json(row))`; nightly verifier."_ §3.3 specifies _"Edge (Worker) runtime: no Node-only libraries in server code; use Web Crypto for hashing."_ Two defects follow.

1. **No serialisation.** A `BEFORE INSERT` trigger reading "the last row" gives two concurrent transactions the same `prev_hash`. Both insert successfully (the `hash` unique constraint does not catch it, because the payloads differ). The chain forks. At the source's own stated peak of 50–500 agent calls per second (Part 16.3), this will happen on day one of real load, and the nightly verifier will fail on a live system whose tamper-evidence is a stated requirement.
2. **Canonicalisation mismatch.** A Postgres `canonical_json(...)` and a JavaScript `JSON.stringify(...)` do not agree on key order, numeric formatting, Unicode normalisation or null handling. A verifier written in one and a writer in the other produces false alarms — or worse, false passes.

**Directive.**

1. **One writer of the chain.** Before reading `prev_hash`, the trigger takes `pg_advisory_xact_lock(<constant>)` — or selects the head row `FOR UPDATE` within the same transaction. Document the choice and the contention it implies under the stated call rate; if contention is unacceptable, the correct answer is a single append path with an in-transaction queue, not an unlocked chain.
2. **Compute the hash in the database**, using `pgcrypto.digest` over an explicitly defined canonicalisation SQL function. Do **not** reimplement canonicalisation in the application, and do not use Web Crypto for the chain. Web Crypto remains fine for unrelated application hashing (content hashes on artifacts).
3. **The verifier is a SQL function** (`verify_ledger()`) that walks the chain and returns the first divergence. The nightly job calls it. The application never verifies the chain itself.
4. Add a test that inserts N ledger rows over M concurrent connections and asserts a single unbroken chain, plus a test that a deliberately altered row is detected by `verify_ledger()`.

**Exit evidence.** The concurrency test passes at the source's peak call rate; `verify_ledger()` detects a tampered row; no application code hashes the chain.

### L-08. Put "THREAD owns the thread, not the state" into Layer A, and test it

**Problem.** Carey's governing sentence — THREAD owns traceability, not runtime execution state; build and environment status belong to the build platforms and are mirrored read-only — appears in the source only as Part 1.4's DESIGN DECISION (_"The platforms own execution; THREAD owns the thread"_). It never reaches Layer A §1, §2 or §9, and Appendix B's carried-design-decisions list omits it. A builder reading Layer A alone will very reasonably add `build_status`, `environment`, `deployment_state` and `is_released` fields to `BuildRun` and a status surface for them — i.e. rebuild the state layer the source exists to remove — and **no acceptance test would catch it**. Part 2.4 already withdraws "release completion" in favour of "controlled exposure and observed value"; the prompt does not carry that withdrawal into the DDL or the tests.

**Directive.**

1. Add to Layer A §1 (Objective):

   > **NON-NEGOTIABLE:** THREAD owns the THREAD, not the STATE. THREAD compiles intent into creation prompts, dispatches them, and records the complete lineage of what was produced and under what authority. The build platforms own execution. Runtime, build and environment status is **mirrored read-only** from the platform, is never authored or mutated in THREAD, and is never a lifecycle state, a metric or a gate.

2. Add to Layer A §2.1 as a prohibition:

   > **PROHIBITED:** any object type, table, column, enum value, lifecycle state, screen, metric or report that records build, environment, deployment, pipeline or release-execution state as THREAD-owned data. No `BuildRun` may carry a writable status field beyond the source's own `outcome: succeeded|failed|partial` and its lineage; no surface may present a build status board.

3. Add acceptance test **AW-16 — "No state ownership"**: an `information_schema` scan and a rendered-surface scan assert the absence of build/environment/deployment/release-execution state fields and views; and a check that every execution-status value present anywhere in the system is marked read-only and carries a `mirrored_from` source reference.

4. Add Part 1.4's DESIGN DECISION to Appendix B's carried-design-decisions list.

**Exit evidence.** AW-16 exists and passes; the constraint appears in both §1 and §2.1; the design decision is listed.

### L-09. Restore verification independence in full

**Problem.** §17 (line 299) compresses a non-negotiable to a parenthetical: _"verification independence (21.3: the test generator and the code generator must be different model routes, and this is recorded)"_. Part 21.3 specifies **five** controls in order of strength and **two published targets**. Layer A is what the builder implements from; as written, four of the five controls and both targets disappear.

**Directive.** Replace the parenthetical with the full requirement:

> **Verification independence (Part 21.3, NON-NEGOTIABLE).** (1) Tests derive from human-confirmed Behaviour Statements and Executable Outcome Contracts — the human assertion is primary and the test is the machine's attempt to falsify it. (2) Independent authoring for compliance-scoped, safety-relevant, financial and rights-affecting behaviour: a separate generation pass with no visibility of the implementation, plus human review of test intent. (3) Mutation testing on a sample — introduce defects and confirm the tests catch them. (4) Sampled human review of generated tests each cycle, rolling across the corpus. (5) **Compute and publish the verification-independence metric** — the share of verification evidence independent of the generating model. **Target: ≥70% overall, 100% for compliance-scoped behaviour.** The metric surfaces to the compliance function and is drill-through to its evidence.

**Exit evidence.** All five controls implemented; the metric computed, published and drillable; a test asserting the compliance-scoped target is enforced and reported.

### L-10. Restrict `usage_sessions` so it cannot become surveillance

**Problem.** §18 (line 508) declares `usage_sessions(id, actor_id, started_at, ended_at, mutating_actions, reads)` with the comment _"AW-5; aggregate-only renditions, never individual (14.3)"_. The comment governs the rendition, not the table. Part 14.3 **PROHIBITS** inferring performance from _"prompt volume, message volume, hours connected or agent calls"_ and _"rank, rate, leaderboard or compare individual humans on activity"_. As specified, this is a per-person activity-volume store with no access restriction, no detector coverage, and nothing preventing its appearance on an admin dashboard. For a HIPAA/PCI-regulated, compliance-first organisation this is the highest-risk table in the file.

**Directive.**

1. `usage_sessions` is **not readable by any application role**. No RLS policy grants `SELECT` to humans or to agent tokens. Only the measurement service, via a `security definer` function, may read it, and only to compute aggregates.
2. Add a `security definer` function `anti_wiki_action_ratio(window)` returning only ratios and counts — no actor ids — and make that the only read path.
3. Add the table to the **prohibited-inference detector's coverage** (Part 14.3): any query or rendition selecting `actor_id` alongside `reads` or `mutating_actions` is refused at generation time.
4. State explicitly: `reads` and `mutating_actions` may never appear in any API response, rendition, export or dashboard at actor granularity, and may never be used to rank, rate or compare people.
5. Add a test asserting a rendition requesting an individual activity metric is refused, and a test asserting no application role can select from `usage_sessions`.

**Exit evidence.** Both tests pass; the only read path returns aggregates; the table is in the detector's coverage list.

---

## Part 3 — Omissions

### L-11. Fix the `no_approval_states` constraint

**Problem.** §18, line 353:

```sql
constraint no_approval_states check (
  to_state !~* '(approv|sign.?off|pending.?review|submitted.?for.?review|awaiting|qa.?phase|gate)')
```

Two defects. `gate` is matched as a **substring**, so legitimate states containing it are rejected — _delegated_, _aggregate_, _investigate_, _mitigate_, _navigate_, _propagate_, _segregate_. A migration adding an authority-delegation state fails with a confusing constraint violation. Second, the constraint applies only to `lifecycle_transitions.to_state`; `objects.lifecycle_state` and `object_versions.lifecycle_state` are unconstrained, so a direct write bypasses it entirely and the only remaining defence is the AW-2 text scan.

**Directive.** Match on **whole words** or against an explicit denylist of exact state names. Apply the same guard to `objects.lifecycle_state` (CHECK or trigger) and to `object_versions`. Keep the AW-2 scan as the third layer. Add a test that inserts each of the six legitimate delegation-style states and asserts acceptance, and a test that writes `'pending_review'` directly to `objects.lifecycle_state` and asserts rejection.

### L-12. Give `ChallengeRef` and canon changes a home

**Problem.** The envelope declares `challenges: [ChallengeRef]`. P15 and Part 10.5 require the full canon-change path — proposed change → evidence → challenge window with actively generated counter-arguments → steward decision under stated authority → new version with the old preserved → dependent renditions stale → dependent capabilities notified. §19 exposes `proposeCanonChange` and `challengeCanon`. §12 and Part 11.11 require a Canon stewardship console with _version history, challenge threads, drift report_. **There is no table, no object type and no lifecycle for any of it.** `ChallengeRef` is not in §4.3's registry either — the source plan under-specifies it, so this is not your error (see Part 4).

**Directive.** Register `CanonChangeProposal` and `ChallengeRef` (or equivalent tables) with: proposed patch, evidence refs, rationale, challenge-window open and close timestamps, counter-arguments, steward, decision ref, resulting version, and the dependent-rendition staleness fan-out. Implement the transition path and a **canon drift metric** as a live published measure (Part 16.5 / Part 15.2 platform health). Mark it DESIGN DECISION, resolving a source gap.

### L-13. Label §19 as representative, and test completeness

**Problem.** §19 presents ~36 operations under the heading "API surface" while §11 and Part 12.2 require the twelve ValueOS tools plus roughly seventy-eight extended operations, and Part 8A.11 adds sixteen more. Entire groups are absent: **Shadow & production** (7), **Assurance** (7), **Capability Fabric lifecycle** (4 of 5), **Detectors & measurement** (8 of 10), **Generation** (3 of 4), plus `get_rendition`, `list_renditions`, `get_canon_history`, `find_related_missions` and several others. A builder given §19 alone under-builds the agent surface — and "agent-executable, not readable" is a named prohibited outcome.

**Directive.** Retitle §19 _"Representative operations (the complete requirement is §11 plus Layer B Parts 12.2 and 8A.11)"_, add the missing groups, and add a completeness test: every row in `tool_contracts` has a matching Zod schema, a matching `createServerFn` and a matching MCP binding, and the total matches a checked-in manifest.

### L-14. Name all eight framing views

**Problem.** §6, line 189 names five views and refers to _"the other two views named in 8A.8."_ Part 8A.8's table defines **eight** views, so six are named and something is silently dropped. Part of the cause is the source: Part 24 calls these "the seven framing-pipeline views" while 8A.8's table lists eight — see S-07. Where the source contradicts itself, **8A.8's table governs**, because it is the specification.

**Directive.** Name all eight explicitly: **Need Web · Decomposition Tree · Session Constellation · Dependency Web · Contradiction Map · Unresolved Frontier · Cross-Session Timeline · Impact Overlay** — each with its interactions (hover isolates a neighbourhood; click an edge for "why is this connected?"; inferred edges visually distinct from stated; draft visually distinct from confirmed; deep-linkable state; export to image and data).

### L-15. Move deterministic gates out of `jsonb`

**Problem.** §3.4 requires a promotion trigger to read `body.provenance.simulated`, and Part 13.2 requires routing to be refused when a provider's attestation has expired. Both are **deterministic gates that must be fast and reliable**. As specified, `simulated` is a jsonb path with no index, and there is no `model_routes` projection at all — so `attestation_expiry` is not queryable, not indexable, and cannot gate anything cheaply. Part 16.4 budgets an MCP tool call at p95 < 300 ms and 50–500 agent calls/second at peak.

**Directive.** Add first-class, indexed columns: `objects.simulated boolean not null default false` (plus the same on evidence-family tables), and a materialised `model_routes` projection with `attestation_expiry`, `cleared_tiers`, `eval_status` and `permitted_task_classes`, refreshed on change. The `simulated_cannot_promote` trigger and the attestation gate read columns, not jsonb.

### L-16. Separate the pure decision from its persistence

**Problem.** §5 requires `src/server/authority/engine.ts` to be _"pure, deterministic … with no I/O and no model calls inside the decision"_, and then requires that _"Every evaluation writes a `PolicyEvaluation` object and a ledger entry."_ A pure function cannot do that. Left as-is, a builder either breaks purity or silently drops the audit write — and the audit write is a non-negotiable.

**Directive.** Split explicitly: `evaluateAuthority()` is pure and returns `{decision, rule_ids, explanation, policy_evaluation_payload}`. The Authority Service persists the `PolicyEvaluation` object and the ledger entry **in the same transaction as the action it authorises**, and a test asserts that no action with `requires_policy_evaluation = true` can commit without both.

### L-17. Restore the graph rendering strategy

**Problem.** §15 reduces Part 16.5 to _"the Nebula rendering strategy (20,000 nodes interactive, honest edge budgets)"_. Part 16.5's seven sub-requirements are labelled a **build requirement, not a detail**, and the first of them — _"Server-side precomputed layouts per view and per cluster. The browser never solves a large layout."_ — is the difference between meeting the ≥30 fps at 20,000 rendered nodes budget and failing it. Dropped items: server-side precomputed layouts; level-of-detail aggregation; incremental subgraph loading; precomputed cluster summaries; deep-linkable view state; **sparsity by default** (the source calls a dense hairball "the failure mode of every graph tool ever built"); keeping the stated edge cap visible ("showing 500 of 3,412").

**Directive.** Move all seven into Layer A §15 and §6/§12 as explicit requirements, each with its own test where testable (first paint < 300 ms clustered; ≥30 fps at 20,000 rendered nodes; a rendered-edge cap displayed in the UI; default view sparse; view state deep-linkable and restorable).

### L-18. Correct the creation loop

**Problem.** §3.2 chains `ValueCell -> ValueBurst -> FramingSession -> ExtractedStatement`, placing the framing session **downstream** of the burst. The source places it **inside** burst phases 1–4 and describes it as the front of the loop and the first place the Intent Model acquires substance. The chain also drops the pre-session AI preparation branch (draft Intent Model, draft contract, disposable probe, the smallest unanswered human questions), which is what makes the "visualization tomorrow" pattern work.

**Directive.** Correct to:

```
ValueSignal → ValueMission → ValueCell
  → (AI prepares pre-session: draft IntentModel, draft ExecutableOutcomeContract,
     candidate hypotheses, disposable probe, smallest unanswered human questions)
  → ValueBurst [ FramingSession = burst phases 1–4 ]
  → confirmed BehaviorStatements + ExecutableOutcomeContract
  → ReuseCheck (hard block) → CreationPrompt → BuildRun → BuildArtifact
  → Test / Simulation / Adversarial → Production Shadow
  → ExposureAuthorization → ProductionOutcome → ValueMeasure → Compound
```

### L-19. Regenerate Appendix A

**Problem.** Appendix A is introduced as _"Verbatim index of NON-NEGOTIABLE and PROHIBITED statements … quoted from the source and binds the build."_ It is not verbatim. Three defect classes:

- **Scrambled table extraction.** A10 merges two table columns across the authority ladder; A21 and A22 are fragments of the §8.2/§8.3 tables reassembled out of order.
- **Heading-only entries.** A13, A15, A18, A48, A51, A55, A57 capture only the lead-in sentence — precisely the entries carrying the decision matrix, the exact `HumanDecisionRequest` fields, the capability characteristics, the `ToolContract`, and both hard routing gates.
- **Wrong section labels.** A23 is Part 8.5 content under a `[PART 8A]` label; A29 is 8A.5 content labelled 8A.6; A31 is 8A.6 content labelled 8A.7; A38 is 8A.10 content labelled 8A.11; A42 is 10.5 content labelled `[PART 11]`; A59 mixes 15.4 with the `[PART 16]` heading.

Because Appendix A is declared binding, a builder that trusts it gets garbage for exactly the entries that matter most. The full correct text is present in Appendix C.

**Directive.** Regenerate Appendix A from Appendix C with (a) the complete text of each item, (b) the correct section label, and (c) a pointer to its Appendix C location. If regenerating is impractical, remove the word "verbatim", relabel it "Index of binding constraints", and give every entry an explicit Appendix C cross-reference — but do not leave it both wrong and labelled binding.

---

## Part 4 — Gaps in the source Build Plan (not your error)

These seven findings originate in ambiguities in the Build Plan itself rather than in your prompt. They are being corrected in **Build Plan Revision 1.2**, and until that is issued **this packet is authoritative** for these points:

|          | Gap                                                                                                                                                                                                  | Resolved by     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **S-01** | `ChallengeRef` / canon-change object model is referenced by the envelope, P15, §19 and Part 11.11 but never registered or given a lifecycle.                                                         | **L-12**        |
| **S-02** | Detector inventory is double-listed — the fifteen ValueOS failure modes appear as prose in Part 1.3.11 and again as keys inside Part 11.9's "THREAD-specific" table.                                 | **L-05**        |
| **S-03** | Provenance spans are described as an array with a CHECK constraint in 8A.4 and as a separate table with a trigger in §18. Neither mechanism alone satisfies "discarded before it reaches the graph". | **L-06**        |
| **S-04** | The `FramingSession` / `ValueBurst` containment relationship is stated in 8A.1 but not carried into Part 8.1's loop diagram.                                                                         | **L-18**        |
| **S-05** | Registry seeding is implied by the FK design but never instructed.                                                                                                                                   | **L-04**        |
| **S-06** | "THREAD owns the thread, not the state" appears only as a Part 1.4 design decision, with no prohibition, no DDL guidance and no acceptance test.                                                     | **L-08, AW-16** |
| **S-07** | Framing-view count is inconsistent: 8A.8's table lists **eight** views, but Part 24 (and the plan's own project log) call them "the seven framing-pipeline views".                                   | **L-14**        |

---

## Part 5 — Non-blocking edits

1. **Undisclosed inventions.** §4 (line 157) and §18 (line 359) specify UUIDv7 for `objects.id`; §19 adds an error-code model. The source says only _"stable, opaque, never reused, never renumbered"_ and defines no error model. Either label each **DESIGN DECISION (Lovable adaptation)** — as your own convention requires, since Layer A must flag every divergence — or drop them. The choices themselves are good; the silence is the problem.
2. **`ContentClassifier`.** §3.4 lists it as an adapter with a simulated implementation. The deterministic regex/Luhn implementation **is** the production implementation — Part 13.2 requires tier scanning to be in-boundary and deterministic and to run before any model call. State that it must be complete from day one and must never be stubbed; only the model-assisted portion may be simulated.
3. **`Transcription` adapter.** §16 Phase 2B says _"using the simulated `Transcription` adapter"_, but Part 8A.13 requires zero-loss capture durability and real diarisation with speaker and authority. Add a **recorded-fixture mode**: deterministic transcripts with speaker labels, timestamps and confidence, sufficient to exercise diarisation, segmentation, authority-aware classification and re-extraction. The live adapter is exercised against the real pilot session in this environment (see L-03).
4. **Layer A §2 compliance gates.** Attestation-expiry blocks routing; evaluation-suite pass blocks routing; invocation logging must be off for Tier A/B routes; Tier C is a hard block before any processing. All four are in Appendix A and Appendix C but not in the Layer A constraint list the builder reads first. Add them to §2.1.
5. **Layer A §2.2, P7 and P8.** Both rows read _"See Layer B Part 3 / Implement as written"_ while every other principle gets a concrete mechanism. Fill them in — P8 in particular needs a Lovable-specific enforcement (RLS plus security-definer predicate functions on every query path including vector and graph search, with a test that a post-filtering implementation **fails**).
6. **§4 citation.** The framing-object schemas are defined in **Part 8A.6**, not 8A.4 (8A.4 is the extraction mapping table). Correct the cross-reference.
7. **§18 edge vocabulary.** The comment _"8A.7 relationship source (explicit|confirmed|derived|proposed...)"_ does not match 8A.7.1's eight ordered sources (stated, drawn, decomposed, capability reference, resolved, co-occurrence, inferred, contradiction). Align the vocabulary and constrain `edges.source` with a CHECK; add a partial unique index on live `(from_id, to_id, verb)` so duplicate edges cannot accumulate.
8. **Un-FK'd lineage.** `evidence_refs`, `derived_from`, `supersedes`, `superseded_by`, `citations`, `extraction_spans.source_ref`, `consent_records.session_id`, `session_events.session_id` and `detector_findings.object_id` are unconstrained. Add the missing foreign keys where the target is `objects(id)`, and a validation trigger that referenced ids exist and are not tombstones — otherwise the traceability graph can dangle, which is the one thing THREAD exists to prevent.
9. **§3.3 claim.** _"Apache AGE … Not available on Lovable"_ is the sole justification for replacing the graph technology. Mark it "verify against current platform capability before relying on it."
10. **Part 25.3's acceptance statements.** The seven tests of a good build prompt are not carried into Layer A. Add them as a closing checklist — particularly the final one: _"handed to someone who had never heard of ValueOS, they would conclude that it is a work environment, not a knowledge base — and would be unable to find a place to file a document."_

---

## Part 6 — Definition of done for this correction round

Before any further capability slice is built, all of the following exist and are demonstrable:

1. AW-5 runs in both states and only blocks when a threshold is set. **(L-02)**
2. The two-part exit-evidence rule is in place; the fixture set exercises every Phase 2B criterion; the real pilot is scheduled with named participants and a real business condition. **(L-03)**
3. A fresh migration yields a working database: every registered type insertable, every verb usable, every lifecycle transition legal, the completeness test passing. **(L-04)**
4. `detectors` matches the 36-key manifest exactly, each with an owner and a passing inducing test. **(L-05)**
5. A span-less extracted object is discarded before persistence; a direct insert is rejected. **(L-06)**
6. N concurrent ledger inserts produce one unbroken chain; `verify_ledger()` detects tampering. **(L-07)**
7. AW-16 (no state ownership) exists and passes. **(L-08)**
8. All five verification-independence controls implemented; the metric published with its targets. **(L-09)**
9. No application role can read `usage_sessions`; the prohibited-inference refusal fires on an individual-activity rendition. **(L-10)**
10. AW-1 … AW-15 plus AW-16 all run, and their results are reported at each slice end.

---

_Prepared 16 October 2026; revised 17 October 2026 to record the approved build environment. Findings L-02 through L-20 verified against `THREAD-Lovable-Build-Prompt.md` (308,466 bytes, 15 Oct 2026) and `THREAD-Build-Plan.html` (306,714 bytes, Rev 1.1). Source-plan gaps S-01 through S-07 are corrected in Build Plan Revision 1.2._
