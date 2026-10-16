CREATE OR REPLACE FUNCTION public.thread_compose_capabilities(p_actor jsonb, p_ids uuid[], p_title text, p_scenario text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare w public.objects; i uuid; bad text; eff public.authority_level;
begin
  perform public._assert_actor(p_actor);
  if coalesce(cardinality(p_ids), 0) < 2 then raise exception 'COMPOSITION_NEEDS_PARTS: compose two or more capabilities'; end if;
  select string_agg(o.human_ref || ' (' || o.lifecycle_state || ')', ', ') into bad from public.objects o
  where o.id = any(p_ids) and (o.type <> 'ComposableCapability' or o.is_tombstone or o.lifecycle_state in ('proposed','retired')
        or coalesce(o.body->>'is_machine_discoverable','false') <> 'true');
  if bad is not null then raise exception 'NOT_PUBLISHED: only published capabilities compose: %', bad; end if;
  w := public.thread_create_object(p_actor, jsonb_build_object('type','WorkingCapability','title',p_title,'statement',coalesce(p_scenario,p_title),
    'machine_description','Composition of published capabilities; effective authority is the minimum of its parts (7.5)',
    'body', jsonb_build_object('capability_refs', to_jsonb(p_ids), 'scenario', p_scenario),
    'review_date', (current_date + 90)::text, 'expiration_condition', jsonb_build_object('kind','review_date_passes'),
    'retirement_path', jsonb_build_object('mode','tombstone'), 'risk_tier', (select max(risk_tier)::text from public.objects where id = any(p_ids)),
    'permission', jsonb_build_object('roles','[]'::jsonb,'purpose','capability composition'), 'data_classification',
    (select max(data_classification)::text from public.objects where id = any(p_ids)), 'rationale', 'compose capabilities (7.5)',
    'owner_id', coalesce((select o.owner_id from public.objects o where o.id = p_ids[1]), (select ur.user_id from public.user_roles ur where ur.role = 'steward' limit 1))));
  foreach i in array p_ids loop
    perform public.thread_create_edge(p_actor, jsonb_build_object('verb','composes','from_id',w.id,'to_id',i,'source','stated','rationale','part of the composition'));
  end loop;
  eff := public.composition_effective_authority(w.id);
  return jsonb_build_object('composition_id', w.id, 'human_ref', w.human_ref, 'effective_authority', eff);
end $function$;
