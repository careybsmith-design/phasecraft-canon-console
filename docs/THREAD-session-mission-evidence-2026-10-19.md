# THREAD session-to-mission implementation evidence — 19 October 2026

## Verdict
Implemented association controls, authority decisions/suggestions, reversal, containment resolver, shared MCP operation, advisory frontier and promoted-signal-first need conversion. Automated database acceptance passes all ten numbered cases, with fixtures rolled back. **Full live acceptance remains partial:** the signed-in account has no active mission and no second real human; the association UI was inspected in its actual empty-mission state, not claimed as a completed live association.

Migrations: **0081–0085**, applied forward-only; migrations 0000–0080 were not edited.

## Design interpretations / limitations
- There is no registered standalone MissionContract. The existing ValueMission contract fields (`co_creator_id` / body.co_creator and body.decision_authority) are the authoritative embedded contract. No global steward or owner override grants linking authority. Delegation requires a current mission-linked AuthorityGrant issued by its named Co-Creator for this exact operation.
- ConfirmedIntentWithoutMission is a separate query-backed advisory catalogue/frontier, deliberately not a new blocking member of the correction packet's 37-detector inventory. Creation has a database scope guard.
- Confirmed objects are not re-scoped by copying fields or rewriting confirmation/provenance; they inherit reversible mission scope through origin_session_ref. The session alone receives a ledgered new association version.
- Need conversion is an explicit action on a confirmed need, resolving matching permission-scoped promoted signals first. It also permits the human to select another readable promoted signal with the mission bounds. It never generates or promotes a signal automatically. A pre-existing body.status=becomes_mission is handled by the frontier and the same signal-first operation. No automatic status watcher was added, because it would silently create consequential missions without human bounds.
- Successful bottom-up need → new mission → session backfill with two real people remains unverified. The database tests prove the missing-signal refusal, not that positive multi-human flow.
- All eight framing views still exist. Session/detail/view data expose the same resolver; all eight views displaying a populated mission were not exercised with live mission data.
- MCP link handler is executable: an agent records a suggestion only, never a human decision. Published external MCP invocation was not exercised.

## Test results
- Complete suite: **1,771 / 1,771 tests**, 42 files.
- Lint: **0 errors**, 11 existing warnings.
- Preview: build OK; signed-in /framing, a real /framing/<id> detail and Unresolved Frontier opened without page errors.
- SQL self-test is service-role-only. Raw output was obtained through a steward-verified server function after direct query access was correctly denied.

## Ten exit evidence items

| Item | Case exercised | Automated result | Live/product acceptance |
|---|---|---|---|
| 1 | Atomic start with mission; field + edge + stated resolver | PASS | Both populated UI surfaces not exercised |
| 2 | Null mission_ref; session → burst → cell → mission | PASS, depth 3 | Eight populated views not exercised |
| 3 | Named mission Co-Creator links retrospectively; decision actor/authority | PASS | Real mission association submission not exercised |
| 4 | Retire association; confirmed row exact equality preserved | PASS | Live reversal not exercised |
| 5 | Non-authority human suggestion; field remains null; frontier mismatch | PASS (rollback-only identity fixture) | A second real human's UI attempt not exercised |
| 6 | Exact entire confirmed object equality before/after backfill | PASS | Production content backfill not exercised |
| 7 | Advisory before association, absent afterwards | PASS | Populated live advisory not exercised |
| 8 | becomes_mission need with no signal; INTENT_AWAITING_SIGNAL and frontier | PASS | Positive two-human conversion not exercised |
| 9 | Actual ValueMission → ValueCell scoped_to insertion | PASS | Existing operating mission not exercised |
| 10 | Actual unframed ValueSignal rejection + NeedStatement edge succeeds | PASS | Rollback-only database evidence |

## Raw database output

```json
{
  "suite": "session_mission",
  "all_ok": true,
  "checks": [
    {
      "ok": true,
      "item": 1,
      "output": {
        "id": "01a15286-f996-704b-9ca3-c855720fc935",
        "depth": 1,
        "title": "Scope selftest mission",
        "origin": "stated",
        "human_ref": "VM-2026-0006"
      }
    },
    {
      "ok": true,
      "item": 2,
      "output": {
        "id": "01a15286-f996-704b-9ca3-c855720fc935",
        "depth": 3,
        "title": "Scope selftest mission",
        "origin": "containment",
        "human_ref": "VM-2026-0006"
      }
    },
    {
      "ok": true,
      "item": 3,
      "output": {
        "edge": {
          "id": "01a15286-ff27-7649-a755-7aeb426b9ecf",
          "kind": null,
          "verb": "scoped_to",
          "to_id": "01a15286-f996-704b-9ca3-c855720fc935",
          "source": "stated",
          "from_id": "01a15286-fd33-743a-a8bf-070d939244a2",
          "rationale": "Retrospective scope decision",
          "confidence": null,
          "created_at": "2026-10-19T04:58:59.458959+00:00",
          "created_by": {
            "id": "c58d4be5-b5e7-4d3a-97c9-f90ba1200932",
            "kind": "human",
            "authority_used": "act_with_confirmation"
          },
          "retired_at": null,
          "evidence_refs": [],
          "authority_used": "act_with_confirmation"
        },
        "origin": "backfilled",
        "reversed": false,
        "decision_id": "01a15286-fecd-74a1-9724-6c817baa5a43",
        "mission_ref": "01a15286-f996-704b-9ca3-c855720fc935",
        "recorded_as": "decision",
        "authority_basis": {
          "kind": "mission_contract",
          "holder": "c58d4be5-b5e7-4d3a-97c9-f90ba1200932",
          "boundary": "Own this mission intent",
          "mission_id": "01a15286-f996-704b-9ca3-c855720fc935"
        }
      }
    },
    {
      "ok": true,
      "item": 7,
      "output": {
        "after": false,
        "before": true
      }
    },
    {
      "ok": true,
      "item": 6,
      "output": {
        "confirmed_object_unchanged": true
      }
    },
    {
      "ok": true,
      "item": 4,
      "output": {
        "edge": {
          "id": "01a15286-ff27-7649-a755-7aeb426b9ecf",
          "kind": null,
          "verb": "scoped_to",
          "to_id": "01a15286-f996-704b-9ca3-c855720fc935",
          "source": "stated",
          "from_id": "01a15286-fd33-743a-a8bf-070d939244a2",
          "rationale": "Retrospective scope decision",
          "confidence": null,
          "created_at": "2026-10-19T04:58:59.458959+00:00",
          "created_by": {
            "id": "c58d4be5-b5e7-4d3a-97c9-f90ba1200932",
            "kind": "human",
            "authority_used": "act_with_confirmation"
          },
          "retired_at": "2026-10-19T04:58:59.458959+00:00",
          "evidence_refs": [],
          "authority_used": "act_with_confirmation"
        },
        "origin": "backfilled",
        "reversed": true,
        "decision_id": "01a15287-0098-70f7-91b3-f4124b6048f0",
        "mission_ref": null,
        "recorded_as": "decision",
        "authority_basis": {
          "kind": "mission_contract",
          "holder": "c58d4be5-b5e7-4d3a-97c9-f90ba1200932",
          "boundary": "Own this mission intent",
          "mission_id": "01a15286-f996-704b-9ca3-c855720fc935"
        }
      }
    },
    {
      "ok": true,
      "item": 5,
      "output": {
        "edge": null,
        "decision_id": null,
        "recorded_as": "suggestion",
        "authority_mismatch": true
      }
    },
    {
      "ok": true,
      "item": 9,
      "output": "ValueMission -> ValueCell scoped_to inserted"
    },
    {
      "ok": true,
      "item": 10,
      "output": {
        "signal_sqlstate": "P0001",
        "signal_exception": "SIGNAL_NOT_FRAMED: VS-2026-0010 cannot become a mission without a framed measurable condition (observed condition and baseline) (Part 5.2)",
        "need_edge_inserted": true
      }
    },
    {
      "ok": true,
      "item": 8,
      "output": {
        "frontier": "intent awaiting a signal",
        "sqlstate": "P0001",
        "exception": "INTENT_AWAITING_SIGNAL: record and promote a readable signal through /signals first"
      }
    }
  ],
  "fixtures_rolled_back": true
}
```

## Files and line references
These references identify new modules in full and modified integration points. Generated types were regenerated by the migration tool; migration journal/snapshots are tool-owned. Memory contains the user's enduring association requirements, not implementation decisions.

- `src/domain/session-mission.ts`: 4,11
- `src/domain/session-mission.test.ts`: 3,9,13,16
- `src/domain/relationships.ts`: 98,184,188
- `src/domain/detection.ts`: 159
- `src/domain/mcp-tools.ts`: 21,967,970
- `src/domain/mcp-output.ts`: 64
- `src/server/ops/session-mission.server.ts`: 1,18,19,34
- `src/server/ops/session-mission.server.test.ts`: 2,30,37,47,49
- `src/server/ops/AGENTS.md`: 3
- `src/server/mcp/tools.server.ts`: 72,73,74
- `src/lib/session-mission.functions.ts`: 4,7,11,17,27,31,59,67,86,88,90,100,102,104,106,121
- `src/lib/framing.functions.ts`: 347,451,457,2950,2953
- `src/components/SessionMissionPanel.tsx`: 7,9,10,16,23,25,28,52
- `src/components/human-surfaces.tsx`: 20,284,288,296,297,299,300,301,326,327,329,346,348,349,375,376
- `src/routes/_authenticated/framing.index.tsx`: 22,117,119,154,190
- `src/routes/_authenticated/framing.$sessionId.tsx`: 36,140,141,179,202
- `src/routes/_authenticated/missions.$missionId.tsx`: 15,127
- `AGENTS.md`: 1-40 (new migration/generated schema or changed signature sections)
- `docs/audit/registry-manifest.json`: 1-3261 (new migration/generated schema or changed signature sections)
- `src/integrations/supabase/types.ts`: 2952,2975,2983,3252,3661,3733
- `drizzle/migrations/0081_session_mission_containment.sql`: 19,37,38,50,77,91,94,105,107,108,112,113,115,117,121,122,123,125,131,134,135,142,143,165,175,183,184,185
- `drizzle/migrations/0082_session_mission_guards_and_acceptance.sql`: 17,21,23,27,28,40,42,47,57,61,62,64,81,83,84
- `drizzle/migrations/0083_session_mission_acceptance_assertion.sql`: 1
- `drizzle/migrations/0084_session_mission_scoped_reads.sql`: 4,8,13
- `drizzle/migrations/0085_session_mission_signal_lookup.sql`: 1,4,5,9,13

Additional evidence files: docs/audit/session-mission-acceptance-2026-10-19.json (raw SQL), session-mission-suite-2026-10-19.txt (full suite), session-mission-browser-2026-10-19.txt (signed-in observations), session-mission-files-2026-10-19.json (references). Roadmap records implementation and remaining acceptance separately.

## Remaining actions
1. Provide a second genuine human account (not an agent) and a real bounded mission / promoted signal, then exercise association from both surfaces and reversal end-to-end.
2. Exercise successful bottom-up conversion with real bounds, Co-Creator and Builder, and inspect inherited scope on confirmed intent.
3. Check populated mission resolution in all eight framing views and the external MCP endpoint.
4. Confirm the embedded MissionContract interpretation with the business owner if a distinct contract object was intended; the current registry does not contain one.

No new approval state, queue, or second confirmation mechanism was added. No release or publication is claimed.
