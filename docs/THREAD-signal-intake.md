# THREAD — Signal Intake (correction round L-22 / S-09, applied 19 October 2026)

Restores the missing front door of the value flow. Reference: `THREAD-Lovable-Correction-Round-Signal-Intake.md`; companion entry in the correction packet: L-22 / S-09. Blocking for Phase 2B framing-session work.

## The restored rule

```
Signal  →  Mission  →  Cell  →  Burst  →  Framing session  →  Requirements
(gap)      (response)                                            (what to build)
```

- No mission without a **promoted** signal — enforced by the `mission_signal_gate` trigger on every ValueMission insert (SI-1), covering both the human surface and the MCP path.
- No framing session without a mission; a session may precede its mission only inside a burst inside a cell that already carries `mission_ref`. **A session may precede its mission, but never its signal.** §8A.16 (bottom-up session linkage) is explicitly not implemented in this round.
- A signal may rest in `detected`, `enriched` or `monitoring` with no mission at all.

## The four channels (§C of the round)

| Channel         | origin            | Model call?                        | Confirmation                          |
| --------------- | ----------------- | ---------------------------------- | ------------------------------------- |
| AI sensor       | `agent_sensor`    | enrichment only, never detection   | promotion requires human authority    |
| Human expertise | `human_expertise` | no                                 | none — creates directly in `detected` |
| Artifact upload | `artifact_upload` | rule-based, after the PHI/PAN gate | human confirms each draft             |
| Live capture    | `live_capture`    | rule-based, after the PHI/PAN gate | human confirms each draft             |

All four write the intake event and the signal together; `intake_event_id` is carried on the signal body. Extraction is deterministic (rule-based) because no live model route is attested (L-15); the PHI/PAN gate runs before any analysis, PAN/SAD is hard-blocked, PHI is quarantined, and blocked attempts are still recorded as intake events with no signal.

## Design decisions and deviations (reported as directive evidence)

1. **Check-constraint deviation.** The round's literal SQL forced `rejected` intake events to carry a `signal_id`, which makes a blocked intake (B.2 rule 1: `status='rejected'`, no signal) unrecordable. Applied intent instead: `confirmed` requires a signal; `rejected` never has one (`intake_signal_required` + `rejected_has_no_signal`).
2. **`captured_as` is not a graph verb.** Intake events are append-only audit rows, not graph objects, so edges cannot reference them. The signal ↔ intake linkage is carried as `body.intake_event_id`. `originated_from` (ValueSignal → Evidence) and `duplicates` (ValueSignal → ValueSignal) are registered verbs.
3. **Append-only intake events.** No UPDATE/DELETE grant to any application role plus a rejecting trigger; extraction drafts are not persisted as events — the single event is written when the attempt resolves (confirmed, rejected or duplicate), keeping SI-2's exactly-one-event rule.
4. **Promotion authority.** Steward role, the signal's owner, or its named recommended Co-Creator may promote; anyone else's promotion is recorded as a suggestion on the signal body and the state is unchanged (SI-7). Every promotion records a ConfirmedDecision linked `decided_from` the signal.
5. **Dedupe.** Normalised-condition equality plus full-text match over live signals; a near-duplicate records `status='duplicate'` with `duplicate_of` and surfaces the existing signal. Duplicates are never merged silently.

## Surfaces

- `/signals` — Signal Intake and Register (11.13). **The only route that can create a ValueSignal**; every other surface links here or promotes an existing signal (AW-4 scan extended accordingly).
- `/signals/$signalId` — Signal detail (11.14): condition, origin channel, intake event, evidence, missions.
- The Feed's secondary action is **Record a signal**, routing to `/signals`; the Feed never creates a signal inline. No engagement mechanics added.
- The Mission Runtime renders the originating signal as a live link with its evidence and origin channel; an unresolvable `signal_ref` is shown as a defect (SI-8).
- The mission form's signal control lists **promoted** signals only, says so when none exist, and offers **Record a new signal**. The Companion's signal button lands on `/signals`.

## Build sequence (B.9)

Phase 2 also delivers Signal Intake because Phase 2B's framing sessions cannot legally exist until missions can be created from promoted signals. Exit evidence: a signal recorded through each channel, a duplicate correctly collapsed, a promotion recorded with authority, and a mission created from a promoted signal.

## User guide addition (B.11)

**Recording a Value Signal.** A Value Signal is the starting point. It records a condition worth acting on — a gap, a risk, an opportunity — before any mission exists. Signals arrive four ways: an AI detector observes it, a person records it directly, an uploaded document is analysed, or a person dictates it in a live capture. Once a signal is promoted, a Co-Creator can turn it into a Value Mission. Missions, cells, bursts and framing sessions all follow from that signal. Mission creation offers two controls: **Select an existing signal** (promoted signals only) and **Record a new signal**.

## Tests (B.10)

`src/domain/signal-intake.test.ts` pins SI-1…SI-8 at the domain-contract level; the six new tools are registered live in the Part 12.2 tool set (AW-13 executability extended). Live-database evidence for the trigger, append-only guard and dedupe path is recorded in the roadmap entry for this round.
