create or replace function public.agent_calls_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'APPEND_ONLY: agent calls are never deleted'; end if;
  if new.agent_id <> old.agent_id or new.tool <> old.tool or new.input_hash <> old.input_hash or new.started_at <> old.started_at then
    raise exception 'APPEND_ONLY: call identity cannot change';
  end if;
  if old.status <> 'running' then
    -- a finished call may only receive its provenance link once
    if old.ledger_seq is null and new.ledger_seq is not null
       and (to_jsonb(new) - 'ledger_seq') = (to_jsonb(old) - 'ledger_seq') then return new; end if;
    raise exception 'APPEND_ONLY: a finished agent call is immutable';
  end if;
  return new;
end $$;