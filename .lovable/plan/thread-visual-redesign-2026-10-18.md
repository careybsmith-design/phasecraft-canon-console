# THREAD visual redesign

## Design for review

The desktop and mobile images are **visual concepts, not changes to the running app**. Their sample entries illustrate spacing and hierarchy; real content, inputs, controls and evidence labels will remain unchanged. In particular, “Domain to follow” stays a text input, despite its dropdown-like appearance in the concepts. The account identity remains available, and no invented sample records, branding symbol or status-color meanings will be introduced.

## Proposed visual changes

- **Refined charcoal workspace:** neutral graphite surfaces, crisp off-white typography, restrained amber primary actions, existing semantic risk/warning/authority colors preserved.
- **Clearer navigation:** all existing destinations in their current order, organized into a slim left rail on larger screens. On smaller screens, a compact horizontal navigator avoids the current multi-line crowding. Companion and sign-out keep their current behavior.
- **Stronger hierarchy:** readable page titles, consistent content gutters, clean section separators, neatly aligned references and metadata.
- **Polished controls:** consistent buttons, inputs, selectors, tabs, tables and dialogs; generous touch targets, clear focus states, readable contrast and subtle transitions that respect reduced-motion preferences.
- **Purposeful page layouts:** unframed evidence lists, visually grouped forms, aligned tables and integrated graph controls. No decorative dashboards, marketing panels or unnecessary cards.

## Apply consistently across existing UIs

Start with the shared navigation and Feed, then carry the approved system across Missions, Simulation, Canon, Graph, Framing, Fabric, Creation, Shadow, Generation, Agents, Assurance, Detection, Measurement, Evidence, Authority, Decisions, Companion and sign-in.

Consent, authority, confirmation, provenance, generated-versus-canon, staleness and simulated-evidence distinctions remain clearly visible. All existing actions, fields, data, links, filters, permissions and process order stay intact. No backend, business-rule or workflow changes.

## Technical implementation

- Update semantic tokens in `src/styles.css`, shared control styling and the authenticated shell; use system sans-serif with monospace identifiers.
- Limit route edits to presentation markup and classes, preserving handlers, queries, validations and action order.
- Keep the graph engine, interactions and data unchanged; adjust only its visual framing and presentation tokens.
- Record presentation architecture rules without changing existing security or audit rules.

## Verification

- Compare existing controls and destinations before and after; ensure none are removed or reinterpreted.
- Check desktop and the current narrow preview width for wrapping, overflow, touch targets and unobstructed content.
- Exercise Feed filters/following, navigation, Companion, representative forms/dialogs and graph controls with the existing signed-in session.
- Run relevant existing tests and check the preview for compile/runtime errors.

**Approval applies only to this visual refresh. The running app has not been redesigned yet.**