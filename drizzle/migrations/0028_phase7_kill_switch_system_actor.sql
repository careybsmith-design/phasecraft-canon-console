-- The kill switch is a safety mechanism: its internal exposure-state change runs as the system actor,
-- while the Rollback object and ledger entries keep the human who pulled it.
create or replace function public.thread_kill_switch(p_actor jsonb, p_capability uuid, p jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cap public.objects; ea public.objects; rb public.objects; requested timestamptz := now(); stopped timestamptz;
  sys jsonb := jsonb_build_object('kind','system','id','thread.kill_switch','authority_used','observe');
begin
  perform public._assert_actor(p_actor);
  select * into cap from public.objects where id = p_capability and not is_tombstone;
  if cap.id is null then raise exception 'NOT_FOUND: capability %', p_capability; end if;
  select * into ea from public.objects o where o.type = 'ExposureAuthorization' and o.body->>'capability_ref' = p_capability::text
    and o.lifecycle_state = 'recorded' and not o.is_tombstone order by o.created_at desc limit 1;
  if ea.id is null then raise exception 'NO_ACTIVE_EXPOSURE: nothing to stop for %', cap.human_ref; end if;
  stopped := now();
  rb := public.thread_create_object(p_actor, public._p7_envelope('Rollback',
    'Kill switch: stop ' || cap.human_ref,
    'Live exposure of ' || cap.title || ' stopped by kill switch ' || coalesce(ea.body->>'kill_switch_ref',''),
    jsonb_build_object('capability_ref', cap.id, 'from_version', cap.version, 'to_version', cap.version,
      'executed_at', stopped, 'executed_by', p_actor, 'outcome', 'exposure_stopped',
      'duration', extract(epoch from (stopped - requested)) * 1000, 'exposure_ref', ea.id, 'reason', coalesce(p->>'reason','kill switch pulled')),
    cap.owner_id, 'Kill switch (9.2)'));
  perform public.thread_transition_object(sys, ea.id, ea.version, 'superseded', 'kill switch pulled by ' || (p_actor->>'id'));
  if cap.authority_level > 'observe' then
    perform public.thread_set_authority(p_actor, cap.id, 'observe', 'withdrawal', 'kill_switch', array[rb.id], jsonb_build_object('trigger_ref', rb.id));
  end if;
  return jsonb_build_object('rollback_id', rb.id, 'human_ref', rb.human_ref, 'stopped_at', stopped,
    'within_bound_ms', 60000, 'duration_ms', extract(epoch from (stopped - requested)) * 1000);
end $$;