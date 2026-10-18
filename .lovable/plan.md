# Live capture, Teams and Outlook ingestion

Three new capabilities for framing sessions and missions, built on the existing Part 8A pipeline (consent gate → capture → segment → classify → extract → confirm). No existing workflow changes.

## 1. Real live speech capture (replaces simulated transcription)

**Model substitution, stated honestly:** the OpenWhisper GitHub repo cannot be self-hosted in this environment (the server runs on edge workers with no GPU/long-running processes). The built-in AI gateway serves `openai/gpt-transcribe` — OpenAI's Whisper-class transcription model — server-side with no extra infrastructure. Same model family, real transcription, streamed results.

- **Live transcription adapter** (`src/server/adapters/transcription/live.ts`) implementing the existing `Transcription` contract, so it plugs into the current pipeline and `adapter_bindings` (live|simulated) switch.
- **Browser capture:** Web Audio API PCM recording encoded as complete WAV chunks (per the speech-to-text guide — MediaRecorder timeslice fragments are undecodable). Chunks upload to a server route every few seconds; the server streams transcription from the gateway and pushes segments into the session timeline via Supabase Realtime, meeting the 8A.13 live-extraction latency budget.
- **Speaker identity (diarisation):** the transcription model does not label speakers. Design: **each participant captures from their own signed-in device** — speaker identity comes from the authenticated participant, which also satisfies the per-participant consent rule (P13). Single-person dictation is the same path with one participant. A single shared room microphone is supported but marks segments "speaker unconfirmed" for manual attribution — never guessed, because speaker authority affects classification (F2).
- **Zero-loss durability (8A.13):** audio chunks are buffered locally (IndexedDB) and re-sent until acknowledged; a network drop cannot lose captured speech.
- Consent gate unchanged: capture cannot open without a ConsentRecord for the audio modality.

## 2. Microsoft Teams ingestion

Uses the **Microsoft Teams App User Connector** (per-user OAuth; each user connects their own Microsoft account — not a shared workspace account).

- Connect/disconnect UI + OAuth popup flow, encrypted connection-key storage (`app_user_connections` table, AES-256-GCM, service-role-only).
- **Chat and channel message ingestion:** pick a chat or channel, pull messages via Microsoft Graph, and ingest them into a framing session (or mission) as `CoCreationArtifact` objects of the **chat/thread** class — lower evidence weight per 8A.2, provenance recording the source chat, sender and timestamp.
- **Honest limitation:** the connector cannot put a bot inside a live Teams meeting. Live capture during a Teams meeting works through capability 1 — each participant runs THREAD capture on their own device while the meeting runs. Teams chat ingestion covers the async conversation between sessions.

## 3. Outlook email ingestion

Uses the **Microsoft Outlook App User Connector** (same per-user OAuth pattern, separate consent).

- Pick an email conversation (thread), ingest messages and **attachments** as `CoCreationArtifact` objects — **brought-in documents** class per 8A.2 — linked to a Value Mission, with content-tier classification and the PHI/PAN detection gate before any model call (Tier C hard-blocks).
- Attachments stored in Lovable Cloud storage with provenance (sender, date, message ID).

## Setup you will need to do

Both Microsoft connectors need a Microsoft Entra app registration (the connect card walks you through it, and one registration can back both). You will add `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback` as a redirect URI there.

## Implementation steps

1. Migration: `app_user_connections` table (encrypted keys, service-role only).
2. `src/integrations/lovable/appUserConnector.ts` + crypto + storage helpers (server-only).
3. OAuth return endpoints (`/api/oauth/microsoft_teams/return`, `/api/oauth/microsoft_outlook/return`) + connect server functions.
4. Live transcription adapter + WAV recorder client + upload/transcribe server route + Realtime push into the session pipeline.
5. Teams ingestion server functions + UI on the framing session surface.
6. Outlook ingestion server functions + UI on the mission surface.
7. Tests: adapter contract tests, consent-gate enforcement, tier-gate-before-model-call, ingestion provenance, reconnect handling. Run full suite.
8. Update roadmap + user guide.

## Verification

- Full test suite + build clean.
- Browser check of capture UI and connect flows (Microsoft consent itself needs your real account).
- Live transcription smoke-tested with synthesized speech through the gateway.
