-- Harden discrepancy handling: tolerate a missing/non-array discrepancies field.
create or replace function public._p7_discrepancies(p jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p->'discrepancies') = 'array' then p->'discrepancies' else '[]'::jsonb end
$$;

create or replace function public.thread_record_shadow_run(p_actor jsonb, p_capability uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cap public.objects; sr public.objects; d jsonb; dids uuid[] := '{}';
  n int; sample int; rate numeric; simulated boolean; clusters jsonb; ds jsonb;
begin
  perform public._assert_actor(p_actor);
  select * into cap from public.objects where id = p_capability and not is_tombstone;
  if cap.id is null then raise exception 'NOT_FOUND: capability %', p_capability; end if;
  if not exists (select 1 from public.object_type_registry r where r.type = cap.type and r.family = 'Capability') then
    raise exception 'NOT_A_CAPABILITY: % is %', cap.human_ref, cap.type; end if;
  sample := coalesce(nullif(p->>'sample_size','')::int, 0);
  if sample <= 0 then raise exception 'SAMPLE_SIZE_REQUIRED: a shadow run needs a positive sample size'; end if;
  ds := public._p7_discrepancies(p);
  n := jsonb_array_length(ds);
  if n > sample then raise exception 'BAD_DISCREPANCY_COUNT'; end if;
  rate := n::numeric / sample;
  simulated := coalesce(p->>'adapter_mode','simulated') = 'simulated';
  select coalesce(jsonb_agg(jsonb_build_object('cause', cause, 'count', cnt, 'case_refs', refs) order by cnt desc), '[]') into clusters
  from (select d0->>'hypothesised_cause' as cause, count(*) as cnt, jsonb_agg(d0->>'case_ref') as refs
        from jsonb_array_elements(ds) d0 group by 1) s;
  sr := public.thread_create_object(p_actor, public._p7_envelope('ShadowRun',
    'Shadow run on ' || cap.human_ref || ' (' || coalesce(p->>'period','period unspecified') || ')',
    'Shadow comparison of ' || sample || ' events against ' || cap.title,
    jsonb_build_object('capability_ref', cap.id, 'event_source', coalesce(p->>'event_source','telemetry tap'),
      'sample_size', sample, 'period', coalesce(p->>'period',''), 'shadow_outputs', coalesce(p->'shadow_outputs','[]'::jsonb),
      'actual_outcomes', coalesce(p->'actual_outcomes','[]'::jsonb), 'comparison_result', case when n = 0 then 'match' else 'discrepancies_found' end,
      'discrepancy_rate', rate, 'cause_clusters', clusters,
      'confidence_evidence', coalesce(p->'confidence_evidence','[]'::jsonb), 'risk_evidence', coalesce(p->'risk_evidence','[]'::jsonb),
      'bias_evidence', coalesce(p->'bias_evidence','[]'::jsonb),
      'conditions_requiring_human_judgment', coalesce(p->'conditions_requiring_human_judgment','[]'::jsonb),
      'provenance', jsonb_build_object('simulated', simulated), 'adapter_mode', coalesce(p->>'adapter_mode','simulated')),
    cap.owner_id, 'Shadow run (Part 9)'));
  for d in select * from jsonb_array_elements(ds) loop
    dids := dids || (public.thread_create_object(p_actor, public._p7_envelope('Discrepancy',
      'Discrepancy ' || coalesce(d->>'case_ref','?') || ' on ' || cap.human_ref,
      'Shadow decided ' || coalesce(d->>'shadow_decision','?') || '; reality decided ' || coalesce(d->>'actual_decision','?'),
      jsonb_build_object('shadow_run_ref', sr.id, 'case_ref', d->>'case_ref', 'shadow_decision', d->>'shadow_decision',
        'actual_decision', d->>'actual_decision', 'delta', coalesce(d->>'delta',''), 'hypothesised_cause', coalesce(d->>'hypothesised_cause','unknown'),
        'disposition', coalesce(d->>'disposition','open'), 'provenance', jsonb_build_object('simulated', simulated)),
      cap.owner_id, 'Shadow discrepancy (9.4)'))).id;
  end loop;
  if not simulated and rate > 0.02 and cap.authority_level > 'observe' then
    perform public.thread_set_authority(p_actor, cap.id, public._demotion_target(cap.authority_level, 'discrepancy_rate_exceeded'),
      'demotion', 'discrepancy_rate_exceeded', dids, jsonb_build_object('trigger_ref', sr.id, 'rate', rate));
  end if;
  return jsonb_build_object('shadow_run_id', sr.id, 'human_ref', sr.human_ref, 'discrepancy_rate', rate,
    'discrepancy_ids', dids, 'cause_clusters', clusters, 'simulated', simulated,
    'demoted', (not simulated) and rate > 0.02 and cap.authority_level > 'observe');
end $$;