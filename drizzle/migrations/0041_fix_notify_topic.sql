create or replace function public.ledger_notify_agents() returns trigger language plpgsql security definer set search_path = public as $$
declare o public.objects; ev_topic text; s record;
begin
  if not exists (select 1 from public.mcp_subscriptions) then return new; end if;
  if new.object_id is not null then select * into o from public.objects where id = new.object_id; end if;
  ev_topic := case
    when new.action like 'authority.%' then 'authority_change'
    when new.action like 'detector.%' or new.action like 'injection.%' then 'detector_finding'
    when o.type in ('ValueMeasure','ProductionOutcome','ValueResult') then 'value_event'
    when o.type = 'HumanDecisionRequest' and new.action = 'object.create' then 'decision_required'
    when o.type = 'ValueMission' then 'mission_state'
    when new.action = 'a2a.message' then 'a2a'
    else null end;
  for s in
    select distinct sub.agent_id, sub.topic, a.auth_user_id from public.mcp_subscriptions sub join public.agents a on a.id = sub.agent_id and a.state = 'active'
    where (sub.topic = ev_topic and (sub.object_id is null or sub.object_id = new.object_id))
       or (sub.topic = 'object' and sub.object_id = new.object_id)
  loop
    if s.topic = 'a2a' and (new.payload->>'to_agent')::uuid is distinct from s.agent_id then continue; end if;
    if o.id is not null and (s.auth_user_id is null or not public._can_read_as(s.auth_user_id, o.permission, o.data_classification)) then continue; end if;
    insert into public.agent_notifications (agent_id, topic, ledger_seq, object_id, body)
    values (s.agent_id, s.topic, new.seq, new.object_id,
      jsonb_build_object('action', new.action, 'human_ref', o.human_ref, 'type', o.type, 'lifecycle_state', o.lifecycle_state, 'occurred_at', new.occurred_at,
        'content_origin', 'canon_event'));
  end loop;
  return new;
end $$;