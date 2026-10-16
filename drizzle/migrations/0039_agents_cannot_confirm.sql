-- DESIGN DECISION (Phase 9): agents may draft and request, but confirming intent, recording decisions and granting
-- authority are made by a person. Enforced on the ledger so every write path is covered.
create or replace function public.ledger_agent_human_only() returns trigger language plpgsql set search_path = public as $$
begin
  if new.actor->>'kind' = 'agent' then
    if new.action = 'object.transition' and new.payload->>'lifecycle_state' in ('confirmed','active','published','authorized','accepted') then
      raise exception 'HUMAN_REQUIRED: an agent cannot move % to %; a person confirms it', new.payload->>'human_ref', new.payload->>'lifecycle_state';
    end if;
    if new.action = 'object.create' and new.payload->>'type' in ('ConfirmedDecision','Decision','AuthorityGrant','ExposureAuthorisation') then
      raise exception 'HUMAN_REQUIRED: an agent cannot record a %; it can request one through the Human Decision Queue', new.payload->>'type';
    end if;
  end if;
  return new;
end $$;
create trigger ledger_agent_human_only before insert on public.ledger for each row execute function public.ledger_agent_human_only();