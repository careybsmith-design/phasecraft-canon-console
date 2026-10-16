-- Phase 7: shadow, exposure and production outcome (Part 9, Part 6.2)
-- Mirrors src/domain/shadow.ts; change both together.

create or replace function public._p7_envelope(p_type text, p_title text, p_statement text, p_body jsonb, p_owner uuid, p_rationale text)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'type', p_type, 'title', left(p_title, 200), 'statement', left(p_statement, 4000),
    'machine_description', p_type || ' recorded by the shadow/exposure loop (Part 9)',
    'body', p_body, 'review_date', (current_date + 90)::text,
    'expiration_condition', jsonb_build_object('kind', 'review_date_passes'),
    'retirement_path', jsonb_build_object('mode', 'archive_evidence'),
    'risk_tier', '1', 'owner_id', p_owner,
    'permission', jsonb_build_object('roles', '[]'::jsonb, 'purpose', 'shadow, exposure and production outcome (Part 9)'),
    'data_classification', 'internal', 'rationale', p_rationale)
$$;

-- 9.2/9.4: record a shadow run with automatic comparison, discrepancy objects, cause clustering
-- and automatic demotion when a non-simulated run breaches the discrepancy bound.
create or replace function public.thread_record_shadow_run(p_actor jsonb, p_capability uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cap public.objects; sr public.objects; d jsonb; dids uuid[] := '{}';
  n int; sample int; rate numeric; simulated boolean; clusters jsonb;
begin
  perform public._assert_actor(p_actor);
  select * into cap from public.objects where id = p_capability and not is_tombstone;
  if cap.id is null then raise exception 'NOT_FOUND: capability %', p_capability; end if;
  if not exists (select 1 from public.object_type_registry r where r.type = cap.type and r.family = 'Capability') then
    raise exception 'NOT_A_CAPABILITY: % is %', cap.human_ref, cap.type; end if;
  sample := coalesce(nullif(p->>'sample_size','')::int, 0);
  if sample <= 0 then raise exception 'SAMPLE_SIZE_REQUIRED: a shadow run needs a positive sample size'; end if;
  n := coalesce(jsonb_array_length(p->'discrepancies'), 0);
  if n > sample then raise exception 'BAD_DISCREPANCY_COUNT'; end if;
  rate := n::numeric / sample;
  simulated := coalesce(p->>'adapter_mode','simulated') = 'simulated';
  select coalesce(jsonb_agg(jsonb_build_object('cause', cause, 'count', cnt, 'case_refs', refs) order by cnt desc), '[]') into clusters
  from (select d0->>'hypothesised_cause' as cause, count(*) as cnt, jsonb_agg(d0->>'case_ref') as refs
        from jsonb_array_elements(coalesce(p->'discrepancies','[]'::jsonb)) d0 group by 1) s;
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
  for d in select * from jsonb_array_elements(coalesce(p->'discrepancies','[]'::jsonb)) loop
    dids := dids || (public.thread_create_object(p_actor, public._p7_envelope('Discrepancy',
      'Discrepancy ' || coalesce(d->>'case_ref','?') || ' on ' || cap.human_ref,
      'Shadow decided ' || coalesce(d->>'shadow_decision','?') || '; reality decided ' || coalesce(d->>'actual_decision','?'),
      jsonb_build_object('shadow_run_ref', sr.id, 'case_ref', d->>'case_ref', 'shadow_decision', d->>'shadow_decision',
        'actual_decision', d->>'actual_decision', 'delta', coalesce(d->>'delta',''), 'hypothesised_cause', coalesce(d->>'hypothesised_cause','unknown'),
        'disposition', coalesce(d->>'disposition','open'), 'provenance', jsonb_build_object('simulated', simulated)),
      cap.owner_id, 'Shadow discrepancy (9.4)'))).id;
  end loop;
  -- 9.4 NON-NEGOTIABLE: a live run above the bound demotes automatically. Simulated evidence never demotes or promotes (3.4).
  if not simulated and rate > 0.02 and cap.authority_level > 'observe' then
    perform public.thread_set_authority(p_actor, cap.id, public._demotion_target(cap.authority_level, 'discrepancy_rate_exceeded'),
      'demotion', 'discrepancy_rate_exceeded', dids, jsonb_build_object('trigger_ref', sr.id, 'rate', rate));
  end if;
  return jsonb_build_object('shadow_run_id', sr.id, 'human_ref', sr.human_ref, 'discrepancy_rate', rate,
    'discrepancy_ids', dids, 'cause_clusters', clusters, 'simulated', simulated,
    'demoted', (not simulated) and rate > 0.02 and cap.authority_level > 'observe');
end $$;

-- 9.2 + Part 4.3: exposure authorisation. Human required; non-simulated evidence; armed rollback and kill switch;
-- progressive population (1,5,25,50,100); Tier 4 needs independent human judgment and continuous monitoring.
create or replace function public.thread_authorize_exposure(p_actor jsonb, p_capability uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cap public.objects; ea public.objects; ev public.objects; cur numeric; req numeric; next_step numeric; granted public.authority_level;
begin
  perform public._assert_actor(p_actor);
  if p_actor->>'kind' <> 'human' then raise exception 'HUMAN_REQUIRED: exposure is authorised by an accountable human (Part 4.3)'; end if;
  select * into cap from public.objects where id = p_capability and not is_tombstone;
  if cap.id is null then raise exception 'NOT_FOUND: capability %', p_capability; end if;
  select * into ev from public.objects where id = nullif(p->>'evidence_bundle_ref','')::uuid and not is_tombstone;
  if ev.id is null then raise exception 'EVIDENCE_REQUIRED: an exposure authorisation needs an evidence bundle'; end if;
  if coalesce(ev.body->'provenance'->>'simulated','false') = 'true' or ev.body->>'adapter_mode' = 'simulated' then
    raise exception 'SIMULATED_EVIDENCE_DOES_NOT_AUTHORIZE: only non-simulated evidence counts (3.4)'; end if;
  if coalesce(p->>'rollback_armed','false') <> 'true' then raise exception 'ROLLBACK_NOT_ARMED: every exposure has an armed rollback'; end if;
  if coalesce(p->>'kill_switch_ref','') = '' then raise exception 'KILL_SWITCH_REQUIRED: every exposure has a kill switch'; end if;
  req := coalesce(nullif(p->>'population_pct','')::numeric, 0);
  select coalesce(max((o.body->'exposure_population'->>'percent')::numeric), 0) into cur from public.objects o
   where o.type = 'ExposureAuthorization' and o.body->>'capability_ref' = p_capability::text
     and o.lifecycle_state = 'recorded' and not o.is_tombstone;
  select s into next_step from (select unnest(array[1,5,25,50,100]::numeric[]) as s) steps where s > cur order by s limit 1;
  if next_step is null then raise exception 'EXPOSURE_COMPLETE: the capability is already at full population'; end if;
  if req <= cur then raise exception 'EXPOSURE_NOT_PROGRESSIVE: %s pct does not extend the current %s pct', req, cur; end if;
  if req > next_step then raise exception 'EXPOSURE_STEP_SKIPPED: the next step from %s pct is at most %s pct (Part 9 progressive population)', cur, next_step; end if;
  granted := coalesce(nullif(p->>'authority_level_granted','')::public.authority_level, cap.authority_level);
  if granted >= 'act_bounded' and cap.risk_tier = '4' and not (coalesce(p->>'continuous_monitoring','') = 'true'
      and coalesce(p->>'independent_human_judgment_ref','') <> '') then
    raise exception 'TIER4_AUTONOMY_PROHIBITED: Tier 4 needs independent human judgment, continuous monitoring and an armed kill switch (6.2)';
  end if;
  ea := public.thread_create_object(p_actor, public._p7_envelope('ExposureAuthorization',
    'Expose ' || cap.human_ref || ' to ' || req || ' pct',
    'Authorised progressive exposure of ' || cap.title || ' at ' || granted,
    jsonb_build_object('capability_ref', cap.id, 'authority_level_granted', granted,
      'exposure_population', jsonb_build_object('percent', req, 'cohort', coalesce(p->>'cohort',''), 'event_set', coalesce(p->'event_set','[]'::jsonb)),
      'conditions', coalesce(p->'conditions','[]'::jsonb), 'rollback_armed', true, 'kill_switch_ref', p->>'kill_switch_ref',
      'authorised_by', p_actor, 'evidence_bundle_ref', ev.id,
      'effective_from', coalesce(p->>'effective_from', now()::text), 'effective_to', p->>'effective_to',
      'authority_can_be_withdrawn', true, 'provenance', jsonb_build_object('simulated', false)),
    cap.owner_id, 'Exposure authorisation (Part 9)'));
  if granted > cap.authority_level then
    perform public.thread_set_authority(p_actor, cap.id, granted, 'grant', 'exposure_authorized', array[ev.id],
      jsonb_build_object('trigger_ref', ea.id, 'kill_switch_armed', 'true',
        'continuous_monitoring', coalesce(p->>'continuous_monitoring','false'),
        'independent_human_judgment_ref', coalesce(p->>'independent_human_judgment_ref',''),
        'explicit_human_grant_ref', coalesce(p->>'explicit_human_grant_ref','')));
  end if;
  return jsonb_build_object('exposure_id', ea.id, 'human_ref', ea.human_ref, 'population_pct', req, 'authority_granted', granted);
end $$;

-- 9.2: the kill switch stops a live exposure, withdraws the authority and records a Rollback.
create or replace function public.thread_kill_switch(p_actor jsonb, p_capability uuid, p jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cap public.objects; ea public.objects; rb public.objects; requested timestamptz := now(); stopped timestamptz;
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
  perform public.thread_transition_object(p_actor, ea.id, ea.version, 'superseded', 'kill switch pulled: exposure stopped');
  if cap.authority_level > 'observe' then
    perform public.thread_set_authority(p_actor, cap.id, 'observe', 'withdrawal', 'kill_switch', array[rb.id], jsonb_build_object('trigger_ref', rb.id));
  end if;
  return jsonb_build_object('rollback_id', rb.id, 'human_ref', rb.human_ref, 'stopped_at', stopped,
    'within_bound_ms', 60000, 'duration_ms', extract(epoch from (stopped - requested)) * 1000);
end $$;

-- 9.2: production outcome capture. Rule 4 (Part 4.5): every production exposure traces to an ExposureAuthorization.
create or replace function public.thread_record_production_outcome(p_actor jsonb, p_capability uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cap public.objects; po public.objects; ea_count int;
begin
  perform public._assert_actor(p_actor);
  select * into cap from public.objects where id = p_capability and not is_tombstone;
  if cap.id is null then raise exception 'NOT_FOUND: capability %', p_capability; end if;
  select count(*) into ea_count from public.objects o where o.type = 'ExposureAuthorization'
    and o.body->>'capability_ref' = p_capability::text and not o.is_tombstone;
  if ea_count = 0 then raise exception 'NO_EXPOSURE_AUTHORIZATION: production outcome without an ExposureAuthorization (Part 4.5 rule 4)'; end if;
  po := public.thread_create_object(p_actor, public._p7_envelope('ProductionOutcome',
    'Production outcome ' || cap.human_ref || ' (' || coalesce(p->>'period','period unspecified') || ')',
    'Observed production behaviour of ' || cap.title,
    jsonb_build_object('capability_ref', cap.id, 'version', cap.version, 'period', coalesce(p->>'period',''),
      'events_processed', coalesce(nullif(p->>'events_processed','')::int, 0), 'outcomes', coalesce(p->'outcomes','[]'::jsonb),
      'behaviour_observed', coalesce(p->>'behaviour_observed',''), 'failures', coalesce(p->'failures','[]'::jsonb),
      'incidents', coalesce(p->'incidents','[]'::jsonb), 'cost', coalesce(nullif(p->>'cost','')::numeric, 0),
      'risk_indicators', coalesce(p->'risk_indicators','[]'::jsonb), 'unintended_consequences', coalesce(p->'unintended_consequences','[]'::jsonb),
      'provenance', jsonb_build_object('simulated', coalesce(p->>'adapter_mode','simulated') = 'simulated'),
      'adapter_mode', coalesce(p->>'adapter_mode','simulated')),
    cap.owner_id, 'Production outcome (9.2)'));
  return jsonb_build_object('outcome_id', po.id, 'human_ref', po.human_ref);
end $$;

-- 9.2: incident recording. 6.2 NON-NEGOTIABLE: a critical or repeated serious incident demotes automatically.
create or replace function public.thread_record_incident(p_actor jsonb, p_capability uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cap public.objects; inc public.objects; sev text; recent int;
begin
  perform public._assert_actor(p_actor);
  select * into cap from public.objects where id = p_capability and not is_tombstone;
  if cap.id is null then raise exception 'NOT_FOUND: capability %', p_capability; end if;
  sev := coalesce(p->>'severity','minor');
  if sev not in ('minor','major','critical') then raise exception 'BAD_SEVERITY: %', sev; end if;
  inc := public.thread_create_object(p_actor, public._p7_envelope('Incident',
    'Incident on ' || cap.human_ref || ': ' || left(coalesce(p->>'description',''), 120),
    coalesce(p->>'description','incident'),
    jsonb_build_object('capability_ref', cap.id, 'severity', sev, 'description', coalesce(p->>'description',''),
      'detection', coalesce(p->>'detection',''), 'response', coalesce(p->>'response',''),
      'rollback_ref', nullif(p->>'rollback_ref','')::uuid, 'root_cause', coalesce(p->>'root_cause',''),
      'learning_ref', nullif(p->>'learning_ref','')::uuid,
      'provenance', jsonb_build_object('simulated', coalesce(p->>'adapter_mode','simulated') = 'simulated'),
      'adapter_mode', coalesce(p->>'adapter_mode','simulated')),
    cap.owner_id, 'Incident (9.2)'));
  select count(*) into recent from public.objects o where o.type = 'Incident' and o.body->>'capability_ref' = p_capability::text
    and o.body->>'severity' in ('major','critical') and o.created_at > now() - interval '30 days' and not o.is_tombstone;
  if (sev = 'critical' or recent >= 2) and cap.authority_level > 'observe'
     and coalesce(p->>'adapter_mode','simulated') <> 'simulated' then
    perform public.thread_set_authority(p_actor, cap.id, 'observe', 'demotion', 'critical_or_repeated_incident', array[inc.id],
      jsonb_build_object('trigger_ref', inc.id, 'severity', sev, 'recent_serious', recent));
  end if;
  return jsonb_build_object('incident_id', inc.id, 'human_ref', inc.human_ref, 'severity', sev,
    'demoted', (sev = 'critical' or recent >= 2) and cap.authority_level > 'observe' and coalesce(p->>'adapter_mode','simulated') <> 'simulated');
end $$;

-- 9.2: rollback recording (an executed rollback that is not a kill switch).
create or replace function public.thread_record_rollback(p_actor jsonb, p_capability uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cap public.objects; rb public.objects;
begin
  perform public._assert_actor(p_actor);
  select * into cap from public.objects where id = p_capability and not is_tombstone;
  if cap.id is null then raise exception 'NOT_FOUND: capability %', p_capability; end if;
  rb := public.thread_create_object(p_actor, public._p7_envelope('Rollback',
    'Rollback ' || cap.human_ref || ' v' || coalesce(p->>'from_version','?') || ' -> v' || coalesce(p->>'to_version','?'),
    'Rollback of ' || cap.title,
    jsonb_build_object('capability_ref', cap.id, 'from_version', p->>'from_version', 'to_version', p->>'to_version',
      'executed_at', coalesce(p->>'executed_at', now()::text), 'executed_by', p_actor,
      'outcome', coalesce(p->>'outcome',''), 'duration', coalesce(nullif(p->>'duration','')::numeric, 0)),
    cap.owner_id, 'Rollback (9.2)'));
  return jsonb_build_object('rollback_id', rb.id, 'human_ref', rb.human_ref);
end $$;

-- P12: value measurement with baseline and delta. Simulated evidence never counts toward a value measure (3.4).
create or replace function public.thread_record_value_measure(p_actor jsonb, p_mission uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare mis public.objects; vm public.objects; sim int;
begin
  perform public._assert_actor(p_actor);
  select * into mis from public.objects where id = p_mission and not is_tombstone;
  if mis.id is null then raise exception 'NOT_FOUND: mission %', p_mission; end if;
  if nullif(p->>'baseline','') is null or nullif(p->>'delta','') is null then
    raise exception 'BASELINE_AND_DELTA_REQUIRED: value is measured against a baseline (P12)'; end if;
  select count(*) into sim from public.objects e where e.id in (select jsonb_array_elements_text(coalesce(p->'source_evidence','[]'::jsonb))::uuid)
    and (coalesce(e.body->'provenance'->>'simulated','false') = 'true' or e.body->>'adapter_mode' = 'simulated');
  if sim > 0 then raise exception 'SIMULATED_EVIDENCE_DOES_NOT_MEASURE_VALUE: only non-simulated evidence counts (3.4)'; end if;
  vm := public.thread_create_object(p_actor, public._p7_envelope('ValueMeasure',
    'Value: ' || left(coalesce(p->>'title','measure'), 150),
    coalesce(p->>'statement','value measured'),
    jsonb_build_object('mission_ref', mis.id, 'measure_ref', nullif(p->>'measure_ref','')::uuid,
      'value', nullif(p->>'value','')::numeric, 'unit', coalesce(p->>'unit',''), 'baseline', nullif(p->>'baseline','')::numeric,
      'delta', nullif(p->>'delta','')::numeric, 'confidence', coalesce(nullif(p->>'confidence','')::numeric, 0),
      'source_evidence', coalesce(p->'source_evidence','[]'::jsonb), 'realised_at', coalesce(p->>'realised_at', now()::text),
      'provenance', jsonb_build_object('simulated', false)),
    mis.owner_id, 'Value measure (P12)'));
  return jsonb_build_object('measure_id', vm.id, 'human_ref', vm.human_ref);
end $$;