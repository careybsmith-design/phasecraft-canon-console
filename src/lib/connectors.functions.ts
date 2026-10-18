/**
 * Per-user Microsoft connector ingestion (Teams chat, Outlook mail) into the Part 8A
 * pipeline. Each end user connects their own Microsoft account (App User Connector);
 * connection keys are stored encrypted server-side. Ingested content becomes
 * CoCreationArtifact objects — chat/thread and brought-in document classes (8A.2) —
 * through the same consent and content-tier gate as every other capture. Server functions
 * only; no provider credential or connection key ever reaches the browser.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// framing.functions helpers are plain (non-server-fn) exports: importing them
// statically would break the server/client split of this module. Load them
// dynamically inside handlers — handler bodies never ship to the client.
async function framingImpl() {
  return import("@/lib/framing.functions");
}
import { classifyContent } from "@/domain/content-tier";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

// Server-only modules are loaded dynamically: this file is a server-function module
// and static imports of server-only code would leak credentials into the client bundle.
async function auc() {
  return import("@/integrations/lovable/appUserConnector");
}
async function connStore() {
  return import("@/server/appUserConnections.server");
}

export const CONNECTORS = {
  microsoft_teams: {
    label: "Microsoft Teams",
    envVar: "MICROSOFT_TEAMS_APP_USER_CONNECTOR_CLIENT_API_KEY",
    scopes: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "Chat.Read",
      "ChannelMessage.Read.All",
      "Team.ReadBasic.All",
    ],
  },
  microsoft_outlook: {
    label: "Microsoft Outlook",
    envVar: "MICROSOFT_OUTLOOK_APP_USER_CONNECTOR_CLIENT_API_KEY",
    scopes: ["openid", "profile", "email", "offline_access", "Mail.Read"],
  },
} as const;
export type ConnectorId = keyof typeof CONNECTORS;

const connectorInput = z.enum(["microsoft_teams", "microsoft_outlook"]);
const uuid = z.string().uuid();

function threadError(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}

function clientKey(connector: ConnectorId): string {
  const key = process.env[CONNECTORS[connector].envVar];
  if (!key)
    throw threadError(
      `CONNECTOR_NOT_CONFIGURED: ${CONNECTORS[connector].label} is not linked to this project yet`,
    );
  return key;
}

function returnUrlFor(connector: ConnectorId): string {
  const request = getRequest();
  if (!request) throw new Error("OAuth must start from an app request.");
  const url = new URL(request.url);
  const sandboxHost =
    url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
  return new URL(
    `/api/oauth/${connector}/return`,
    sandboxHost ? `https://${sandboxHost}` : url.origin,
  ).toString();
}

export const startConnectorConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ connector: connectorInput }).parse(d))
  .handler(async ({ data, context }) => {
    const { getConnectionKeyForUser } = await connStore();
    const existing = await getConnectionKeyForUser(context.userId, data.connector);
    const { authorizeAppUserOAuth } = await auc();
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: data.connector,
      appUserId: context.userId,
      clientAPIKey: clientKey(data.connector),
      returnUrl: returnUrlFor(data.connector),
      ...(existing ? { connectionAPIKey: existing } : {}),
      credentialsConfiguration: {
        scopes: [...CONNECTORS[data.connector].scopes],
        prompt: "select_account",
      },
    });
    return { authorizationUrl };
  });

export const completeConnectorConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await auc();
    const { saveConnectionKeyForUser } = await connStore();
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (!(connectorId in CONNECTORS))
      throw threadError("CONNECTOR_MISMATCH: OAuth completion returned an unknown connector");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true, connector: connectorId };
  });

export const disconnectConnector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ connector: connectorInput }).parse(d))
  .handler(async ({ data, context }) => {
    const { getConnectionKeyForUser, deleteConnectionKeyForUser } = await connStore();
    const { disconnectAppUser } = await auc();
    const key = await getConnectionKeyForUser(context.userId, data.connector);
    if (key)
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: data.connector,
      });
    await deleteConnectionKeyForUser(context.userId, data.connector);
    return { ok: true };
  });

export const getConnectorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const out: Record<string, { connected: boolean; configured: boolean; label: string }> = {};
    for (const id of Object.keys(CONNECTORS) as ConnectorId[]) {
      const { getConnectionKeyForUser } = await connStore();
      out[id] = {
        connected: !!(await getConnectionKeyForUser(context.userId, id)),
        configured: !!process.env[CONNECTORS[id].envVar],
        label: CONNECTORS[id].label,
      };
    }
    return out;
  });

async function callGraph(
  uid: string,
  connector: ConnectorId,
  path: string,
): Promise<{ ok: true; json: any } | { ok: false; reason: string }> {
  const { getConnectionKeyForUser } = await connStore();
  const { callAsAppUser, appUserReconnectRequired } = await auc();
  const key = await getConnectionKeyForUser(uid, connector);
  if (!key) return { ok: false, reason: "not_connected" };
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: connector,
    path,
    requiredScopes: [...CONNECTORS[connector].scopes],
  });
  if (await appUserReconnectRequired(res)) return { ok: false, reason: "reconnect_required" };
  if (!res.ok) {
    const body = await res.text();
    console.error(`Graph call failed [${res.status}] ${path}: ${body}`);
    throw threadError(`PROVIDER_ERROR: ${CONNECTORS[connector].label} returned ${res.status}`);
  }
  return { ok: true, json: (await res.json()) as any };
}

/** Binary download through the connector gateway (e.g. attachment $value). */
async function callGraphBlob(
  uid: string,
  connector: ConnectorId,
  path: string,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: string }> {
  const { getConnectionKeyForUser } = await connStore();
  const { callAsAppUser, appUserReconnectRequired } = await auc();
  const key = await getConnectionKeyForUser(uid, connector);
  if (!key) return { ok: false, reason: "not_connected" };
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: connector,
    path,
    requiredScopes: [...CONNECTORS[connector].scopes],
  });
  if (await appUserReconnectRequired(res)) return { ok: false, reason: "reconnect_required" };
  if (!res.ok) {
    const body = await res.text();
    console.error(`Graph download failed [${res.status}] ${path}: ${body}`);
    throw threadError(`PROVIDER_ERROR: ${CONNECTORS[connector].label} returned ${res.status}`);
  }
  return { ok: true, bytes: new Uint8Array(await res.arrayBuffer()) };
}

// ---------------------------------------------------------------- Teams

export const listTeamsChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await callGraph(
      context.userId,
      "microsoft_teams",
      "/me/chats?$top=50&$expand=members",
    );
    if (!r.ok) return r;
    const chats = ((r.json.value as Array<any>) ?? []).map((c) => ({
      id: c.id as string,
      topic: (c.topic as string | null) ?? null,
      chatType: c.chatType as string,
      members: ((c.members as Array<any>) ?? [])
        .map((m) => m.displayName as string)
        .filter(Boolean),
    }));
    return { ok: true as const, chats };
  });

export const listTeamsChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const teamsR = await callGraph(context.userId, "microsoft_teams", "/me/joinedTeams");
    if (!teamsR.ok) return teamsR;
    const teams = (teamsR.json.value as Array<{ id: string; displayName: string }>) ?? [];
    const out: Array<{ teamId: string; teamName: string; channelId: string; name: string }> = [];
    for (const t of teams.slice(0, 20)) {
      const ch = await callGraph(
        context.userId,
        "microsoft_teams",
        `/teams/${t.id}/channels`,
      );
      if (!ch.ok) continue;
      for (const c of (ch.json.value as Array<{ id: string; displayName: string }>) ?? [])
        out.push({ teamId: t.id, teamName: t.displayName, channelId: c.id, name: c.displayName });
    }
    return { ok: true as const, channels: out };
  });

interface GraphMessage {
  id: string;
  createdDateTime?: string;
  from?: { user?: { displayName?: string } | null } | null;
  body?: { contentType?: string; content?: string };
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Ingest a Teams chat or channel into a framing session. Each message becomes a
 * chat/thread artifact (8A.2: lower evidence weight) through the standard pipeline.
 * Speaker is matched to a participant by display name; unmatched senders use the
 * chosen fallback participant and the real sender is recorded in provenance.
 */
export const ingestTeamsMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        session_id: uuid,
        fallback_speaker_id: uuid,
        chat_id: z.string().optional(),
        team_id: z.string().optional(),
        channel_id: z.string().optional(),
        max_messages: z.number().int().min(1).max(100).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.chat_id && !(data.team_id && data.channel_id))
      throw threadError("INVALID_INPUT: choose a chat or a channel");
    const path = data.chat_id
      ? `/chats/${encodeURIComponent(data.chat_id)}/messages?$top=${data.max_messages}`
      : `/teams/${encodeURIComponent(data.team_id!)}/channels/${encodeURIComponent(data.channel_id!)}/messages?$top=${data.max_messages}`;
    const r = await callGraph(context.userId, "microsoft_teams", path);
    if (!r.ok) return r;

    const { captureUtteranceImpl, loadSessionFor } = await framingImpl();
    const db = await (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const session = await loadSessionFor(db, context.userId, data.session_id);
    const participants = (session.body?.participants ?? []) as Array<{
      id: string;
      name: string;
    }>;
    const messages = ((r.json.value as GraphMessage[]) ?? []).reverse();
    let ingested = 0;
    let skipped = 0;
    const sourceRef = data.chat_id ?? `${data.team_id}/${data.channel_id}`;
    for (const m of messages) {
      const text = htmlToText(m.body?.content ?? "");
      if (!text) {
        skipped++;
        continue;
      }
      const sender = m.from?.user?.displayName ?? "unknown";
      const match = participants.find(
        (p) => p.name.trim().toLowerCase() === sender.trim().toLowerCase(),
      );
      const out = await captureUtteranceImpl(
        context.userId,
        {
          session_id: data.session_id,
          speaker_id: match?.id ?? data.fallback_speaker_id,
          text: `[Teams · ${sender} · ${m.createdDateTime ?? "unknown time"}] ${text}`.slice(
            0,
            4000,
          ),
          mode: "chat",
          t_offset_ms: 0,
          client_id: `teams-${m.id}`,
        },
        "live",
      );
      if (out.duplicate) skipped++;
      else ingested++;
    }
    return { ok: true as const, ingested, skipped, source: sourceRef };
  });

// ---------------------------------------------------------------- Outlook

export const listOutlookMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ search: z.string().max(200).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const path = data.search
      ? `/me/messages?$top=25&$search="${encodeURIComponent(data.search)}"&$select=id,subject,from,receivedDateTime,hasAttachments,conversationId`
      : `/me/messages?$top=25&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments,conversationId`;
    const r = await callGraph(context.userId, "microsoft_outlook", path);
    if (!r.ok) return r;
    const messages = ((r.json.value as Array<any>) ?? []).map((m) => ({
      id: m.id as string,
      subject: (m.subject as string) ?? "(no subject)",
      from:
        ((m.from as any)?.emailAddress as any)
          ?.address as string ?? "unknown",
      received: m.receivedDateTime as string,
      hasAttachments: !!m.hasAttachments,
      conversationId: m.conversationId as string,
    }));
    return { ok: true as const, messages };
  });

/**
 * Ingest an Outlook message (and its attachments) into a framing session as
 * brought-in documents (8A.2). The message text runs the consent/tier gate and the
 * extraction pipeline; attachments are stored with provenance and classified before
 * any model call — Tier C hard-blocks.
 */
export const ingestOutlookMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        session_id: uuid,
        message_id: z.string().min(1),
        speaker_id: uuid,
        include_attachments: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { captureUtteranceImpl } = await framingImpl();
    const r = await callGraph(
      context.userId,
      "microsoft_outlook",
      `/me/messages/${encodeURIComponent(data.message_id)}?$select=id,subject,from,receivedDateTime,body,hasAttachments,conversationId`,
    );
    if (!r.ok) return r;
    const m = r.json as unknown as {
      id: string;
      subject?: string;
      receivedDateTime?: string;
      conversationId?: string;
      from?: { emailAddress?: { address?: string } };
      body?: { contentType?: string; content?: string };
      hasAttachments?: boolean;
    };
    const sender = m.from?.emailAddress?.address ?? "unknown";
    const text = htmlToText(m.body?.content ?? "");
    const header = `[Outlook · ${sender} · ${m.receivedDateTime ?? "unknown time"}] Subject: ${m.subject ?? "(no subject)"}`;
    const out = await captureUtteranceImpl(
      context.userId,
      {
        session_id: data.session_id,
        speaker_id: data.speaker_id,
        text: `${header}\n\n${text}`.slice(0, 4000),
        mode: "brought_in_document",
        t_offset_ms: 0,
        client_id: `outlook-${m.id}`,
      },
      "live",
    );

    const attachments: Array<{ name: string; stored: boolean; reason?: string }> = [];
    if (data.include_attachments && m.hasAttachments && !out.duplicate && !out.blocked) {
      const ar = await callGraph(
        context.userId,
        "microsoft_outlook",
        `/me/messages/${encodeURIComponent(data.message_id)}/attachments?$select=id,name,contentType,size`,
      );
      if (ar.ok) {
        const { create, extractor, loadSessionFor, payload } = await framingImpl();
        const db = await (await import("@/integrations/supabase/client.server")).supabaseAdmin;
        const session = await loadSessionFor(db, context.userId, data.session_id);
        for (const a of (ar.json.value as Array<any>) ?? []) {
          const name = (a.name as string) ?? "attachment";
          const contentType = (a.contentType as string) ?? "application/octet-stream";
          const size = (a.size as number) ?? 0;
          if (size > 25 * 1024 * 1024) {
            attachments.push({ name, stored: false, reason: "over 25 MB" });
            continue;
          }
          const dl = await callGraphBlob(
            context.userId,
            "microsoft_outlook",
            `/me/messages/${encodeURIComponent(data.message_id)}/attachments/${encodeURIComponent(a.id as string)}/$value`,
          );
          if (!dl.ok) {
            attachments.push({ name, stored: false, reason: dl.reason });
            continue;
          }
          // Tier gate on what we know about the file before storing (8A.3)
          const tier = classifyContent(`${name} ${contentType}`);
          if (tier.tier === "C") {
            attachments.push({ name, stored: false, reason: "content tier C hard-block" });
            continue;
          }
          const path = `outlook/${data.session_id}/${m.id}/${a.id}`;
          const bytes = dl.bytes;
          const up = await db.storage
            .from("artifacts")
            .upload(path, bytes, { contentType, upsert: true });
          if (up.error) {
            attachments.push({ name, stored: false, reason: up.error.message });
            continue;
          }
          await create(db, extractor(context.userId), {
            ...payload(
              "CoCreationArtifact",
              `Email attachment · ${name}`,
              `Attachment ${name} from Outlook message ${m.subject ?? m.id}`,
              {
                session_ref: data.session_id,
                kind: "brought_in_document",
                media_ref: path,
                content: null,
                duration_or_size: size,
                captured_at: new Date().toISOString(),
                captured_by: context.userId,
                speaker_id: data.speaker_id,
                content_tier: tier.tier,
                consent_basis: [],
                extraction_state: "pending",
                evidence_weight: "corroborating",
                provenance: {
                  simulated: false,
                  adapter: "Outlook.connector",
                  source: "microsoft_outlook",
                  message_id: m.id,
                  conversation_id: m.conversationId ?? null,
                  from: sender,
                  received: m.receivedDateTime ?? null,
                  attachment_name: name,
                },
              },
              {
                owner: session.owner_id,
                tier: tier.tier,
                rationale: "Ingested from Outlook with provenance",
              },
            ),
          });
          attachments.push({ name, stored: true });
        }
      }
    }
    return { ...out, attachments, from: sender, subject: m.subject ?? null };
  });
