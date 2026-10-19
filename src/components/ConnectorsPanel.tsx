/**
 * Microsoft Teams and Outlook ingestion panel for a framing session. Each user
 * connects their own Microsoft account (per-user OAuth); chats, channel messages,
 * emails and attachments are ingested as CoCreationArtifacts through the standard
 * consent/tier-gated pipeline (8A.2 chat/thread and brought-in document classes).
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  completeConnectorConnect,
  startConnectorConnect,
  disconnectConnector,
  getConnectorStatus,
  ingestOutlookMessage,
  ingestTeamsMessages,
  listOutlookMessages,
  listTeamsChannels,
  listTeamsChats,
} from "@/lib/framing.functions";
import type { Participant } from "@/domain/framing";

type Status = Record<string, { connected: boolean; configured: boolean; label: string }>;

function errText(e: unknown): string {
  try {
    const m = JSON.parse((e as Error).message) as { explanation?: string };
    return m.explanation ?? (e as Error).message;
  } catch {
    return (e as Error).message;
  }
}

function waitForOAuthCompletion(popup: Window, connectorId: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== connectorId ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error("OAuth connection failed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("OAuth window closed before completion."));
    }, 500);
  });
}

export function ConnectorsPanel({
  sessionId,
  participants,
  onDone,
}: {
  sessionId: string;
  participants: Participant[];
  onDone: () => void;
}) {
  const startConnect = useServerFn(startConnectorConnect);
  const statusFn = useServerFn(getConnectorStatus);
  const completeFn = useServerFn(completeConnectorConnect);
  const disconnectFn = useServerFn(disconnectConnector);
  const chatsFn = useServerFn(listTeamsChats);
  const channelsFn = useServerFn(listTeamsChannels);
  const ingestTeamsFn = useServerFn(ingestTeamsMessages);
  const outlookListFn = useServerFn(listOutlookMessages);
  const ingestOutlookFn = useServerFn(ingestOutlookMessage);

  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [speaker, setSpeaker] = useState(participants[0]?.id ?? "");
  const [chats, setChats] = useState<
    Array<{ id: string; topic: string | null; chatType: string; members: string[] }>
  >([]);
  const [channels, setChannels] = useState<
    Array<{ teamId: string; teamName: string; channelId: string; name: string }>
  >([]);
  const [teamsTarget, setTeamsTarget] = useState("");
  const [emails, setEmails] = useState<
    Array<{ id: string; subject: string; from: string; received: string; hasAttachments: boolean }>
  >([]);
  const [emailId, setEmailId] = useState("");
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => setStatus(await statusFn()), [statusFn]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async (connector: "microsoft_teams" | "microsoft_outlook") => {
    const popup = window.open("", "lovable-oauth", "width=600,height=720");
    if (!popup) {
      toast.error("Popup blocked. Allow popups and try again.");
      return;
    }
    setBusy(true);
    try {
      const { authorizationUrl } = await startConnect({ data: { connector } });
      const completion = waitForOAuthCompletion(popup, connector);
      popup.location.href = authorizationUrl;
      const code = await completion;
      if (code) await completeFn({ data: { code } });
      await refresh();
      toast.success(`Connected to ${connector === "microsoft_teams" ? "Teams" : "Outlook"}`);
    } catch (e) {
      popup.close();
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const loadTeams = async () => {
    setBusy(true);
    try {
      const [c, ch] = await Promise.all([chatsFn(), channelsFn()]);
      if (c.ok) setChats(c.chats);
      if (ch.ok) setChannels(ch.channels);
      if (!c.ok || !ch.ok) toast.error("Reconnect your Microsoft account to continue");
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const ingestTeams = async () => {
    if (!teamsTarget || !speaker) return;
    setBusy(true);
    try {
      const [kind, a, b] = teamsTarget.split("|");
      const r = await ingestTeamsFn({
        data:
          kind === "chat"
            ? { session_id: sessionId, fallback_speaker_id: speaker, chat_id: a, max_messages: 50 }
            : {
                session_id: sessionId,
                fallback_speaker_id: speaker,
                team_id: a,
                channel_id: b,
                max_messages: 50,
              },
      });
      if (!r.ok) toast.error("Reconnect your Microsoft account to continue");
      else {
        toast.success(`Ingested ${r.ingested} message(s) from Teams (${r.skipped} skipped)`);
        onDone();
      }
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const loadEmails = async () => {
    setBusy(true);
    try {
      const r = await outlookListFn({ data: { search: search || undefined } });
      if (r.ok) setEmails(r.messages);
      else toast.error("Reconnect your Microsoft account to continue");
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const ingestEmail = async () => {
    if (!emailId || !speaker) return;
    setBusy(true);
    try {
      const r = await ingestOutlookFn({
        data: {
          session_id: sessionId,
          message_id: emailId,
          speaker_id: speaker,
          include_attachments: true,
        },
      });
      if ("ok" in r && r.ok === false) toast.error("Reconnect your Microsoft account to continue");
      else {
        const att =
          (r as { attachments?: Array<{ name: string; stored: boolean }> }).attachments ?? [];
        toast.success(
          `Email ingested (${(r as { statements?: number }).statements ?? 0} statement(s); ${att.filter((a) => a.stored).length} attachment(s) stored)`,
        );
        onDone();
      }
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const teams = status?.["microsoft_teams"];
  const outlook = status?.["microsoft_outlook"];

  return (
    <section className="space-y-3 rounded-md border bg-panel p-3" aria-label="Microsoft ingestion">
      <h2 className="label-caps">Teams &amp; Outlook ingestion</h2>
      <p className="text-xs text-muted-foreground">
        Connect your own Microsoft account, then bring Teams chats and Outlook emails into this
        session. Everything passes the same consent and content-tier gate as live capture.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          aria-label="Participant for ingested content"
          className="h-8 rounded border bg-background px-2 text-sm"
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.decision_authority ? " ★" : ""}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Used when a sender cannot be matched to a participant by name.
        </span>
      </div>

      <div className="space-y-2 rounded border p-2">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm">Teams</strong>
          {!teams?.configured ? (
            <span className="text-xs text-warn">
              Setup needed: the Teams connector is not linked to this project yet.
            </span>
          ) : teams.connected ? (
            <>
              <span className="text-xs text-ok">Connected</span>
              <Button size="sm" variant="outline" onClick={() => void loadTeams()} disabled={busy}>
                List chats &amp; channels
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void disconnectFn({ data: { connector: "microsoft_teams" } }).then(refresh)
                }
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => void connect("microsoft_teams")} disabled={busy}>
              Connect Teams
            </Button>
          )}
        </div>
        {(chats.length > 0 || channels.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Teams chat or channel"
              className="h-8 max-w-full rounded border bg-background px-2 text-sm"
              value={teamsTarget}
              onChange={(e) => setTeamsTarget(e.target.value)}
            >
              <option value="">Choose a chat or channel…</option>
              {chats.map((c) => (
                <option key={c.id} value={`chat|${c.id}`}>
                  Chat: {c.topic ?? c.members.join(", ") ?? c.id.slice(0, 12)}
                </option>
              ))}
              {channels.map((c) => (
                <option
                  key={`${c.teamId}/${c.channelId}`}
                  value={`channel|${c.teamId}|${c.channelId}`}
                >
                  {c.teamName} / {c.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={() => void ingestTeams()}
              disabled={busy || !teamsTarget || !speaker}
            >
              Ingest into session
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded border p-2">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm">Outlook</strong>
          {!outlook?.configured ? (
            <span className="text-xs text-warn">
              Setup needed: the Outlook connector is not linked to this project yet.
            </span>
          ) : outlook.connected ? (
            <>
              <span className="text-xs text-ok">Connected</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void disconnectFn({ data: { connector: "microsoft_outlook" } }).then(refresh)
                }
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => void connect("microsoft_outlook")} disabled={busy}>
              Connect Outlook
            </Button>
          )}
        </div>
        {outlook?.connected && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Search email"
              className="h-8 rounded border bg-background px-2 text-sm"
              placeholder="Search email (optional)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => void loadEmails()} disabled={busy}>
              Find emails
            </Button>
            {emails.length > 0 && (
              <>
                <select
                  aria-label="Email to ingest"
                  className="h-8 max-w-full rounded border bg-background px-2 text-sm"
                  value={emailId}
                  onChange={(e) => setEmailId(e.target.value)}
                >
                  <option value="">Choose an email…</option>
                  {emails.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.subject} — {m.from}
                      {m.hasAttachments ? " 📎" : ""}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => void ingestEmail()}
                  disabled={busy || !emailId || !speaker}
                >
                  Ingest email &amp; attachments
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
