# THREAD operator runbooks — Phase 12

These are operational procedures, not canon, assurance attestations or production-readiness evidence. The relevant control and execution evidence must be recorded in THREAD. Existing unfinished acceptance items remain in `roadmap.md`.

## Evidence-integrity incident

1. Steward/compliance opens Assurance and runs **Check and record integrity**. Preserve the receipt, timestamp and first bad ledger sequence from the verifier; never log captured content or credentials.
2. If ledger verification or snapshot replay fails, stop consequential writes/exposure through the managed platform and the relevant live feature-flag adapter. A database-state change alone does not prove production stopped.
3. Preserve the ledger and object versions. Never repair by deleting, editing, renumbering or rehashing historic entries.
4. Record an Incident with a named owner, investigation evidence and the chosen response. Escalate to the compliance function when integrity, privacy, rights or safety are affected.
5. Restore only through the approved infrastructure owner. Verify the restored ledger and version hashes before resuming, independently review the result and attach execution-platform evidence.

## Backup and recovery rehearsal

**Targets:** RPO ≤15 minutes, RTO ≤4 hours. No production restore has been verified by this implementation.

1. Infrastructure owner verifies point-in-time recovery availability, backup retention, encryption, ledger replication and restore access in the inherited AI Factory/hosting controls.
2. Capture a recovery starting point: UTC time, ledger head hash/sequence and version integrity results. Use no production credentials in builds.
3. Restore an actual backup to an isolated environment. Record start, completion, most recent recovered event and evidence from the backup platform.
4. Calculate actual RPO and RTO from those timestamps. Execute `thread_verify_ledger()` and `thread_restore_rehearsal()` in the restored environment; compare the recovered head to the expected checkpoint, accounting explicitly for permitted RPO.
5. Attach a live ControlCheck with `restore_executed`, `rpo_minutes`, `rto_minutes`, `post_restore_ledger_verified`, execution reference and observed hashes. Independent human reviews the results.
6. Record the recovery condition in Assurance. Snapshot replay on the current database is labelled simulated and must not be substituted for steps 3–5.

## Penetration findings and production exposure

1. Commission an independent authorized penetration test before platform production exposure and annually. Define scope and safe test windows with the hosting/security owner; do not attack third-party services without authorization.
2. Import execution evidence as SecurityScan (`kind: dast`) with independent assessor provenance. Create owned findings; remediation requires re-test evidence. Accepted risk requires a recorded human decision and future expiry through Detection.
3. Keep `unaddressed_findings` nonzero until every finding is closed or accepted by an authorized owner. Record the source of that count and decision references.
4. Record the penetration assurance condition. Internal scans and synthetic negative tests are not an independent penetration test.
5. Tier 4 requires a current ConfirmedDecision identifying the capability, authored by the actual authorizing human who is distinct from the named Builder and creator. Tier 3/4 adversarial execution and compliance-scoped independent verification remain separate required evidence.

## Retention, legal hold and erasure

1. Existing rendition sweep runs hourly; the existing morning brief schedule is 05:00 UTC. Timings remain provisional pending steward confirmation. Renditions expire after seven days or source change and their body/storage pointer is purged 24 hours after staleness; audit stamps remain.
2. Check scheduler execution and failures using the managed job operations. Record timestamp and ledger `rendition.sweep` receipts when rows are affected. A job existing does not prove successful execution.
3. Do not physically purge operating objects, evidence, ledger or versions. Withdraw using tombstones with a reason and provenance; their historical references must continue to resolve.
4. Compliance-scoped evidence requires a canon-owned retention schedule, six-year retention and legal hold by default. A complete per-class retention/legal-hold/erasure mechanism is still outstanding; until implemented, no physical evidence purge is allowed.
5. On consent withdrawal, stop capture immediately and record a disposition decision. Personal-data erasure requires compliance review, lawful basis, affected graph references and a recorded compromise preserving graph integrity. Never treat a source erasure as permission to destroy its audit chain.

## Scale rehearsal

1. Run only against an isolated test environment with representative permission-scoped graph shapes. Never seed millions of fixtures into production.
2. Tenfold upper year-one targets: 5M operating objects, 30M relationships, 15M evidence objects, 1M live renditions, 2,000 concurrent humans, 5,000 agent calls/s. These are planning estimates, not measured capacity.
3. Exercise sparse and high-degree graphs, restricted bridges, detector sweeps, hot/cold reads, rendition invalidation and bounded MCP batches. Measure p95, failures, CPU/database work and resource ceilings.
4. Budgets: object read <50ms; graph 2–3 hops <250ms; depth-6 closure <800ms; bounded paths <1s; Fabric <400ms; evidence chain <1.5s; MCP non-generation <300ms; full detector sweep <15min/incremental <60s; graph ≥30fps at 20,000 rendered nodes.
5. Record the workload, software/config versions, runtime identity and raw execution reference. Do not present a source/unit benchmark as live scale evidence.

## Compliance officer and assessor walkthrough

1. Start with the honest limitation: THREAD proves records and linkage, not the truth of evidence, effectiveness of controls or wisdom of decisions.
2. Pick an actual capability in Assurance, **Query evidence**, follow citations to source versions, inspect authority, decision, tests, exposure, outcome and value. Missing links remain missing, not inferred.
3. Demonstrate permission refusal with a second differently privileged human, stale-rendition refusal, consent gating, independent judgment and expiring accepted risk.
4. Independently time an assessor's real question from asking to cited answer; target <1 hour. Query execution time alone is not the walkthrough result.
5. Keep unresolved items owned. The platform is not certified and Phase 12 exit is not met until independent audit and live evidence exist.

## Accessibility audit

Audit authenticated surfaces with keyboard-only navigation, screen readers, 200%/400% zoom, reduced motion, contrast, focus order and accessible adjacency/evidence equivalents for graphs. Record a WCAG 2.2 AA AccessibilityEvaluation with checks, findings, execution source and remediation/retest evidence. Signed-out checks cannot establish authenticated accessibility.