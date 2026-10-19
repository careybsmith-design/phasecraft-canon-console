# Signal saving validation — 19 October 2026

## Findings

- Existing VS-2026-0009 and VS-2026-0010 were saved in `detected`, with matching confirmed intake events and current-version ledger entries. They were not missing records.
- At the reported 503×612 viewport, the direct record button was below the initial visible screen (y=829). It existed but was easy to miss.
- Mission sources intentionally list only `promoted` signals. Saving and promotion are separate operations; entering fields alone never saves.
- Typed capture completion produces draft conditions. A human must confirm each draft before a ValueSignal exists.

## Changes

- Direct entry places **Save signal** immediately after the condition, before collapsible optional details.
- Typed capture labels its completion action **Complete capture and review signals**, followed by **Confirm and save signal** on each draft.
- Persistent on-page saved references, errors and no-candidate outcomes replace reliance on transient notifications.
- The saved reference offers the existing authority-bound promotion action and a return to Value Missions after successful promotion.
- Draft confirmation preserves the originating capture reference and removes a successfully confirmed draft from the pending list.
- Mission selection explicitly identifies its promoted-only eligibility. No authority or database promotion rules changed.

## Actual signed-in execution

- Mission UI → Record a new signal → direct condition → Save signal created labelled validation record **VS-2026-0011**, `detected`.
- Reload showed the saved record; the Mission UI correctly excluded this unpromoted signal.
- Typed capture opened with consent, completed with business-condition text, and confirmed a draft into labelled validation record **VS-2026-0012**.
- Promotion with a recorded rationale succeeded for the signed-in steward. Returning to Mission UI offered VS-2026-0012 and selection succeeded.
- Reload showed the typed record. Database read-back confirmed `live_capture`, its capture source reference, a matching confirmed intake event and a ledger entry for the current promoted version.
- VS-2026-0011 also has a matching confirmed intake event and current-version ledger entry.
- No browser page errors. Screenshots inspected for saved receipt and selected mission source.
- 31 targeted tests passed across signal domain, SI-1 SQL-contract, field-gating and routing suites. Latest preview compilation: build OK.

These two explicitly labelled validation records remain in the register; no real business mission was fabricated or created. Full two-human mission acceptance remains separately open.