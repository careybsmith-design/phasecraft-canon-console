drop trigger if exists ledger_notify_agents on public.ledger;
create constraint trigger ledger_notify_agents after insert on public.ledger deferrable initially deferred
  for each row execute function public.ledger_notify_agents();