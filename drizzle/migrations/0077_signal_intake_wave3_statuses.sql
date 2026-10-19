alter type public.intake_status add value if not exists 'no_proposal';
alter type public.intake_status add value if not exists 'abandoned';

create table public.signal_intake_captures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  purpose text not null,
  modalities jsonb not null,
  consent_confirmed boolean not null,
  status text not null default 'open' check (status in ('open','completed','abandoned')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
comment on table public.signal_intake_captures is 'W3.2: persisted live-capture attempts. Owned, consent-gated, single-use; the audit trail of outcomes lives in signal_intake_events.';
grant select on public.signal_intake_captures to authenticated;
grant all on public.signal_intake_captures to service_role;
alter table public.signal_intake_captures enable row level security;
create policy captures_read_own on public.signal_intake_captures
  for select to authenticated using (owner_id = auth.uid());