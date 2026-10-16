-- Phase 5: Evidence graph (Part 5)

-- 5.1 chain verbs. DESIGN DECISION: decided_from, built and renews are added because Part 4.2 has no verb for these links.
insert into public.relationship_verbs (verb, from_types, to_types, directed, signatures, impact, computed, acyclic) values
 ('decided_from', array['ConfirmedDecision'], array['ValueSignal','FramingSession'], true, '[{"from":["ConfirmedDecision"],"to":["ValueSignal","FramingSession"]}]', 'reverse', false, false),
 ('built', array['BuildRun'], array['ComposableCapability','WorkingCapability'], true, '[{"from":["BuildRun"],"to":["ComposableCapability","WorkingCapability"]}]', 'forward', false, false),
 ('renews', array['ConfirmedDecision'], array['ExposureAuthorization'], true, '[{"from":["ConfirmedDecision"],"to":["ExposureAuthorization"]}]', 'none', false, false)
on conflict (verb) do nothing;

update public.relationship_verbs set to_types = to_types || array['ComposableCapability'],
  signatures = signatures || '[{"from":["ExposureAuthorization"],"to":["ComposableCapability"]}]'::jsonb
  where verb = 'authorised_by' and not ('ComposableCapability' = any(to_types));
update public.relationship_verbs set from_types = from_types || array['ComposableCapability'],
  signatures = signatures || jsonb_build_array(jsonb_build_object('from', jsonb_build_array('ComposableCapability'), 'to', to_jsonb(to_types)))
  where verb in ('observed_as','simulated_by','challenged_by','shadowed_by') and not ('ComposableCapability' = any(from_types));

create or replace function public._fwd(_verb text, _ids uuid[]) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(distinct e.to_id), '{}') from public.edges e join public.objects o on o.id = e.to_id and not o.is_tombstone
  where e.retired_at is null and e.verb = _verb and e.from_id = any(_ids) $$;
create or replace function public._rev(_verb text, _ids uuid[]) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(distinct e.from_id), '{}') from public.edges e join public.objects o on o.id = e.from_id and not o.is_tombstone
  where e.retired_at is null and e.verb = _verb and e.to_id = any(_ids) $$;
create or replace function public._of_type(_ids uuid[], _types text[]) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(o.id), '{}') from public.objects o where o.id = any(_ids) and o.type = any(_types) and not o.is_tombstone $$;

create or replace function public.decision_ancestor(p_behavior uuid) returns uuid language sql stable set search_path = public as $$
  select d.id from public.objects b join public.objects d on d.type = 'ConfirmedDecision' and not d.is_tombstone
   and (d.id::text = b.body->>'source_decision_ref' or d.human_ref = b.body->>'source_decision_ref'
        or exists (select 1 from public.edges e where e.retired_at is null and e.verb = 'confirmed_by' and e.from_id = b.id and e.to_id = d.id))
  where b.id = p_behavior order by d.created_at limit 1 $$;

create or replace function public.can_reach_creation(p_behavior uuid) returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.objects b where b.id = p_behavior and not b.is_tombstone
    and b.lifecycle_state not in ('draft','proposed','rejected','superseded')) and public.decision_ancestor(p_behavior) is not null $$;

create or replace function public._is_current_member(_u uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _u) $$;

create or replace function public.chain_link_guard() returns trigger language plpgsql set search_path = public as $$
declare bad text;
begin
  if TG_OP = 'INSERT' and NEW.type = 'ConfirmedDecision' then
    if coalesce(NEW.body->>'signal_ref', NEW.body->>'session_ref', NEW.body->>'session_id', NEW.body->>'canon_change_id') is null
       and coalesce(jsonb_array_length(case when jsonb_typeof(NEW.body->'provenance_spans') = 'array' then NEW.body->'provenance_spans' end), 0) = 0 then
      raise exception 'DECISION_WITHOUT_SIGNAL: a Confirmed Decision must cite the signal it arose from (Part 5.2)';
    end if;
  end if;
  if TG_OP = 'INSERT' and NEW.type = 'CreationPrompt' and jsonb_typeof(NEW.body->'behavior_statement_refs') = 'array' then
    select string_agg(x, ', ') into bad from jsonb_array_elements_text(NEW.body->'behavior_statement_refs') x
      where not public.can_reach_creation(x::uuid);
    if bad is not null then raise exception 'NO_DECISION_ANCESTOR: % cannot reach creation without a Confirmed Decision ancestor (Part 5.2)', bad; end if;
  end if;
  if NEW.type in ('ComposableCapability','WorkingCapability') and NEW.lifecycle_state is distinct from (case when TG_OP = 'UPDATE' then OLD.lifecycle_state end) then
    if NEW.lifecycle_state in ('limited_exposure','producing_value') and cardinality(public._rev('authorised_by', array[NEW.id])) = 0 then
      raise exception 'EXPOSURE_NOT_AUTHORISED: no exposure without an Exposure Authorization (Part 5.2)';
    end if;
    if NEW.lifecycle_state = 'producing_value' and cardinality(public._fwd('values', public._fwd('observed_as', array[NEW.id]))) = 0 then
      raise exception 'VALUE_MEASURE_REQUIRED: "producing value" requires a value measure; otherwise the capability is underperforming (Part 5.2)';
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists a7_chain_link_guard on public.objects;
create trigger a7_chain_link_guard before insert or update on public.objects for each row execute function public.chain_link_guard();

create or replace function public.chain_edge_guard() returns trigger language plpgsql set search_path = public as $$
declare s public.objects;
begin
  if NEW.verb in ('promoted_from','signals') then
    select * into s from public.objects where id = case when NEW.verb = 'promoted_from' then NEW.to_id else NEW.from_id end;
    if coalesce(btrim(s.body->>'observed_condition'), '') = '' or coalesce(s.body->>'baseline_performance', s.body->>'magnitude') is null then
      raise exception 'SIGNAL_NOT_FRAMED: % cannot become a mission without a framed measurable condition (observed condition and baseline) (Part 5.2)', s.human_ref;
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists b_chain_edge_guard on public.edges;
create trigger b_chain_edge_guard before insert on public.edges for each row execute function public.chain_edge_guard();

create or replace function public.creation_decision_gate() returns trigger language plpgsql set search_path = public as $$
declare bad text;
begin
  select string_agg(o.human_ref, ', ') into bad from public.objects o where o.id = any(NEW.source_behavior_ids) and not public.can_reach_creation(o.id);
  if bad is not null then raise exception 'NO_DECISION_ANCESTOR: % cannot reach creation without a Confirmed Decision ancestor (Part 5.2)', bad; end if;
  return NEW;
end $$;
drop trigger if exists c_creation_decision_gate on public.creation_prompts;
create trigger c_creation_decision_gate before insert on public.creation_prompts for each row execute function public.creation_decision_gate();

create or replace function public._chain_obj(_ids uuid[]) returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'ref', o.human_ref, 'type', o.type, 'title', o.title, 'state', o.lifecycle_state,
    'version', o.version, 'created_at', o.created_at, 'evidence_refs', o.evidence_refs, 'body', o.body) order by o.created_at), '[]')
  from public.objects o where o.id = any(_ids) and not o.is_tombstone $$;

create or replace function public.evidence_chain(p_id uuid) returns jsonb language plpgsql stable set search_path = public as $$
declare root public.objects; caps uuid[] := '{}'; bs uuid[] := '{}'; prompts uuid[]; runs uuid[]; decs uuid[]; sigs uuid[]; tests uuid[];
  exps uuid[]; outs uuid[] := '{}'; vals uuid[]; incs uuid[]; links jsonb; ids uuid[];
begin
  select * into root from public.objects where id = p_id;
  if root.id is null then raise exception 'NOT_FOUND: object % is not visible to you', p_id; end if;
  if root.type in ('ComposableCapability','WorkingCapability') then caps := array[root.id];
  elsif root.type = 'BehaviorStatement' then bs := array[root.id];
    caps := public._fwd('references_capability', bs) || public._fwd('built', public._fwd('executed_as', public._fwd('compiled_into', bs)));
  elsif root.type = 'ProductionOutcome' then outs := array[root.id]; caps := public._rev('observed_as', outs);
  elsif root.type = 'Incident' then outs := public._rev('caused', array[root.id]); caps := public._rev('observed_as', outs);
  elsif root.type = 'ExposureAuthorization' then caps := public._fwd('authorised_by', array[root.id]);
  elsif root.type = 'ConfirmedDecision' then bs := public._rev('confirmed_by', array[root.id]) || coalesce((select array_agg(b.id) from public.objects b where b.type = 'BehaviorStatement' and not b.is_tombstone and b.body->>'source_decision_ref' in (root.id::text, root.human_ref)), '{}');
    caps := public._fwd('references_capability', bs);
  end if;
  caps := caps || public._of_type(public._fwd('composes', caps), array['ComposableCapability']);
  runs := public._rev('built', caps);
  prompts := public._rev('executed_as', runs);
  bs := bs || public._of_type(public._rev('compiled_into', prompts) || public._rev('references_capability', caps), array['BehaviorStatement']);
  decs := public._of_type(public._fwd('confirmed_by', bs), array['ConfirmedDecision'])
    || coalesce((select array_agg(public.decision_ancestor(b)) from unnest(bs) b where public.decision_ancestor(b) is not null), '{}');
  if root.type = 'ConfirmedDecision' then decs := decs || root.id; end if;
  sigs := public._fwd('decided_from', decs) || coalesce((select array_agg(s.id) from public.objects d join public.objects s
      on s.id::text in (d.body->>'signal_ref', d.body->>'session_ref', d.body->>'session_id') where d.id = any(decs)), '{}');
  tests := public._fwd('verified_by', caps || bs) || public._fwd('simulated_by', caps) || public._fwd('challenged_by', caps) || public._fwd('shadowed_by', caps);
  exps := public._rev('authorised_by', caps);
  outs := outs || public._fwd('observed_as', caps);
  vals := public._fwd('values', outs);
  incs := public._fwd('caused', outs);
  links := jsonb_build_array(
    jsonb_build_object('hop', 1, 'link', 'signal', 'label', 'Source Signal', 'objects', public._chain_obj(sigs),
      'basis', (select jsonb_agg(distinct coalesce(d.body->>'canon_change_id', '')) from public.objects d where d.id = any(decs) and d.body ? 'canon_change_id')),
    jsonb_build_object('hop', 2, 'link', 'decision', 'label', 'Confirmed Decision', 'objects', public._chain_obj(decs)),
    jsonb_build_object('hop', 3, 'link', 'behavior', 'label', 'Intended Behaviour', 'objects', public._chain_obj(bs)),
    jsonb_build_object('hop', 4, 'link', 'implement', 'label', 'Implement', 'objects', public._chain_obj(prompts || runs)),
    jsonb_build_object('hop', 5, 'link', 'test', 'label', 'Test + Simulate', 'objects', public._chain_obj(tests)),
    jsonb_build_object('hop', 6, 'link', 'release', 'label', 'Release Authority', 'objects', public._chain_obj(exps)),
    jsonb_build_object('hop', 7, 'link', 'outcome', 'label', 'Production Outcome', 'objects', public._chain_obj(outs || incs)),
    jsonb_build_object('hop', 8, 'link', 'value', 'label', 'Value', 'objects', public._chain_obj(vals)));
  ids := sigs || decs || bs || prompts || runs || caps || tests || exps || outs || incs || vals;
  return jsonb_build_object('root', jsonb_build_object('id', root.id, 'ref', root.human_ref, 'type', root.type, 'title', root.title, 'state', root.lifecycle_state, 'version', root.version),
    'capabilities', public._chain_obj(caps), 'links', links, 'incidents', public._chain_obj(incs),
    'edges', coalesce((select jsonb_agg(public.graph_edge_json(e)) from public.edges e where e.retired_at is null and e.from_id = any(ids) and e.to_id = any(ids)), '[]'));
end $$;

create or replace function public.chain_completeness(p_id uuid) returns jsonb language sql stable set search_path = public as $$
  with c as (select public.evidence_chain(p_id) j), l as (select x from c, jsonb_array_elements(c.j->'links') x)
  select jsonb_build_object('object_id', p_id,
    'links', (select jsonb_agg(jsonb_build_object('hop', x->'hop', 'link', x->'link', 'label', x->'label', 'present', jsonb_array_length(x->'objects') > 0, 'count', jsonb_array_length(x->'objects')) order by (x->>'hop')::int) from l),
    'missing', coalesce((select jsonb_agg(x->'link' order by (x->>'hop')::int) from l where jsonb_array_length(x->'objects') = 0), '[]'),
    'present', (select count(*) from l where jsonb_array_length(x->'objects') > 0), 'total', 8,
    'score', round((select count(*) from l where jsonb_array_length(x->'objects') > 0)::numeric / 8, 3)) $$;

create or replace function public._cite(_objs jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', o->'id', 'ref', o->'ref', 'type', o->'type', 'title', o->'title')), '[]') from jsonb_array_elements(_objs) o $$;

create or replace function public._explain(p_chain jsonb, p_question text) returns jsonb language plpgsql stable set search_path = public as $$
declare lk jsonb := '{}'; x jsonb; cites jsonb; ans text; answered boolean; reasons text[] := '{}'; cap jsonb; ev uuid[];
begin
  for x in select * from jsonb_array_elements(p_chain->'links') loop lk := lk || jsonb_build_object(x->>'link', x->'objects'); end loop;
  cap := coalesce(p_chain->'capabilities'->0, p_chain->'root');
  case p_question
  when 'decision' then
    cites := public._cite((lk->'signal') || (lk->'decision'));
    answered := jsonb_array_length(lk->'decision') > 0;
    ans := case when answered then format('It exists because of %s, decided as %s: %s', coalesce((select string_agg(s->>'ref' || ' "' || (s->>'title') || '"', ', ') from jsonb_array_elements(lk->'signal') s), 'an unrecorded signal'),
      (select string_agg(d->>'ref', ', ') from jsonb_array_elements(lk->'decision') d), (lk->'decision'->0->>'title')) else 'No Confirmed Decision is linked, so why it exists is not established.' end;
  when 'authority' then
    cites := public._cite(lk->'decision');
    answered := jsonb_array_length(lk->'decision') > 0;
    ans := case when answered then format('Authorised by %s (authority used: %s, by %s). It now operates at %s.',
        (select string_agg(d->>'ref', ', ') from jsonb_array_elements(lk->'decision') d),
        coalesce(lk->'decision'->0->'body'->>'authority_used', 'not recorded'),
        coalesce(lk->'decision'->0->'body'->'confirmation'->>'actor_name', lk->'decision'->0->'body'->>'decided_by', 'not recorded'),
        coalesce((select authority_level::text from public.objects where id = (cap->>'id')::uuid), 'unknown'))
      else 'No authorising decision is recorded.' end;
  when 'evidence' then
    select coalesce(array_agg(distinct e::uuid), '{}') into ev from jsonb_array_elements(lk->'decision') d, jsonb_array_elements_text(d->'evidence_refs') e;
    cites := public._cite(public._chain_obj(ev));
    answered := cardinality(ev) > 0 or jsonb_array_length(lk->'signal') > 0;
    if jsonb_array_length(lk->'signal') > 0 and cardinality(ev) = 0 then cites := public._cite(lk->'signal'); end if;
    ans := case when answered then format('The decision is supported by %s evidence object(s)%s.', jsonb_array_length(cites),
      coalesce(' (' || (select string_agg(c->>'ref', ', ') from jsonb_array_elements(cites) c) || ')', '')) else 'No evidence supporting the decision is recorded.' end;
  when 'version' then
    cites := public._cite(lk->'implement') || jsonb_build_array(jsonb_build_object('id', cap->'id', 'ref', cap->'ref', 'type', cap->'type', 'title', cap->'title'));
    answered := jsonb_array_length(lk->'implement') > 0;
    ans := format('%s is at version %s%s.', cap->>'ref', cap->>'version',
      case when answered then ', implemented by ' || (select string_agg(r->>'ref' || coalesce(' (' || (r->'body'->>'platform') || ')', ''), ', ') from jsonb_array_elements(lk->'implement') r)
      else '; no build run is linked, so which build implemented it is not established' end);
  when 'tests' then
    cites := public._cite(lk->'test'); answered := jsonb_array_length(lk->'test') > 0;
    ans := case when answered then format('Evaluated by %s.', (select string_agg(t->>'ref' || ' ' || (t->>'type') || coalesce(' — ' || (t->'body'->>'pass_fail'), ''), ', ') from jsonb_array_elements(lk->'test') t))
      else 'No tests or simulations are recorded.' end;
  when 'exposure' then
    cites := public._cite(lk->'release'); answered := jsonb_array_length(lk->'release') > 0;
    ans := case when answered then (select string_agg(format('%s authorised by %s for %s until %s', a->>'ref', coalesce(a->'body'->>'authorised_by', 'unrecorded'),
        coalesce(a->'body'->>'exposure_population', 'unstated population'), coalesce(a->'body'->>'effective_to', 'no end date')), '; ') from jsonb_array_elements(lk->'release') a)
      else 'No exposure has been authorised, so it must not be exposed.' end;
  when 'outcome' then
    cites := public._cite(lk->'outcome'); answered := jsonb_array_length(lk->'outcome') > 0;
    ans := case when answered then (select string_agg(format('%s %s: %s', p->>'ref', p->>'type', coalesce(p->'body'->>'behaviour_observed', p->'body'->>'description', p->>'title')), '; ') from jsonb_array_elements(lk->'outcome') p)
      else 'Nothing has been observed in production.' end;
  when 'value' then
    cites := public._cite(lk->'value') || public._cite(p_chain->'incidents'); answered := jsonb_array_length(lk->'value') > 0 or jsonb_array_length(lk->'outcome') > 0;
    ans := concat_ws(' ',
      case when jsonb_array_length(lk->'value') > 0 then 'Value: ' || (select string_agg(format('%s delta %s %s (baseline %s)', v->>'ref', coalesce(v->'body'->>'delta', '?'), coalesce(v->'body'->>'unit', ''), coalesce(v->'body'->>'baseline', '?')), '; ') from jsonb_array_elements(lk->'value') v) || '.' else 'No value measure is recorded.' end,
      'Cost: ' || coalesce((select string_agg(coalesce(p->'body'->>'cost', 'unrecorded'), ', ') from jsonb_array_elements(lk->'outcome') p where p->>'type' = 'ProductionOutcome'), 'unrecorded') || '.',
      'Harm: ' || jsonb_array_length(p_chain->'incidents') || ' incident(s).');
  when 'justification' then
    if coalesce(cap->>'state', '') = 'retired' then reasons := reasons || 'it is retired'::text; end if;
    if jsonb_array_length(lk->'decision') = 0 then reasons := reasons || 'no Confirmed Decision ancestor'::text; end if;
    if not exists (select 1 from jsonb_array_elements(lk->'value') v where (v->>'created_at')::timestamptz >= now() - interval '90 days') then reasons := reasons || 'no value evidence in the last 90 days'::text; end if;
    if exists (select 1 from jsonb_array_elements(lk->'release') a where a->'body'->>'effective_to' ~ '^\d{4}-\d{2}-\d{2}' and (a->'body'->>'effective_to')::timestamptz < now()) then reasons := reasons || 'an exposure authorisation has expired'::text; end if;
    if jsonb_array_length(p_chain->'incidents') > 0 then reasons := reasons || (jsonb_array_length(p_chain->'incidents') || ' incident(s) recorded'); end if;
    if exists (select 1 from public.objects where id = (cap->>'id')::uuid and review_date < current_date) then reasons := reasons || 'its review date has passed'::text; end if;
    cites := public._cite((lk->'decision') || (lk->'value') || (lk->'release') || (p_chain->'incidents')); answered := true;
    ans := case when cardinality(reasons) = 0 then 'Yes — continued operation is justified: it has a decision, current value evidence, valid authorisation and no incidents.'
      else 'Not justified as it stands: ' || array_to_string(reasons, '; ') || '.' end;
  else raise exception 'UNKNOWN_QUESTION: % is not one of the nine questions', p_question;
  end case;
  return jsonb_build_object('question', p_question, 'answered', answered, 'answer', ans, 'citations', cites);
end $$;

create or replace function public.explain_capability(p_id uuid, p_question text) returns jsonb language sql stable set search_path = public as $$
  select public._explain(public.evidence_chain(p_id), p_question) $$;

create or replace function public.explain_capability_all(p_id uuid) returns jsonb language sql stable set search_path = public as $$
  with c as (select public.evidence_chain(p_id) j)
  select jsonb_build_object('root', c.j->'root', 'completeness', public.chain_completeness(p_id),
    'answers', (select jsonb_agg(public._explain(c.j, q) order by n) from unnest(array['decision','authority','evidence','version','tests','exposure','outcome','value','justification']) with ordinality u(q, n)))
  from c $$;

create or replace function public._prod_caps() returns setof public.objects language sql stable set search_path = public as $$
  select * from public.objects where type in ('ComposableCapability','WorkingCapability') and not is_tombstone
    and lifecycle_state in ('limited_exposure','producing_value','underperforming') $$;
create or replace function public._list(_q text, _rows jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('query', _q, 'count', jsonb_array_length(coalesce(_rows, '[]')), 'rows', coalesce(_rows, '[]')) $$;

create or replace function public.trace_blast_radius(p_behavior uuid) returns jsonb language plpgsql stable set search_path = public as $$
begin
  if not exists (select 1 from public.objects where id = p_behavior and type = 'BehaviorStatement') then raise exception 'WRONG_TYPE: blast radius starts from a Behaviour Statement'; end if;
  return public.graph_closure(p_behavior, 6) || jsonb_build_object('query', 'blast_radius');
end $$;
create or replace function public.trace_canon_change_impact(p_id uuid) returns jsonb language plpgsql stable set search_path = public as $$
begin
  if not exists (select 1 from public.objects where id = p_id and type in ('Guardrail','Pattern','Authority','Rule','AuthorityGrant')) then raise exception 'WRONG_TYPE: start from a Guardrail, Pattern or Authority rule'; end if;
  return public.graph_closure(p_id, 6) || jsonb_build_object('query', 'canon_change_impact');
end $$;
create or replace function public.trace_value_without_owner() returns jsonb language sql stable set search_path = public as $$
  select public._list('value_without_owner', jsonb_agg(public.graph_node_json(o))) from public.objects o
  where o.type in ('ComposableCapability','WorkingCapability') and not o.is_tombstone and o.lifecycle_state = 'producing_value'
    and not public._is_current_member(o.owner_id) $$;
create or replace function public.trace_production_without_value(p_period interval default interval '90 days') returns jsonb language sql stable set search_path = public as $$
  select public._list('production_without_value', jsonb_agg(public.graph_node_json(c))) from public._prod_caps() c
  where not exists (select 1 from public.edges e1 join public.edges e2 on e2.from_id = e1.to_id and e2.verb = 'values' and e2.retired_at is null
      join public.objects v on v.id = e2.to_id and not v.is_tombstone and v.created_at >= now() - p_period
      where e1.from_id = c.id and e1.verb = 'observed_as' and e1.retired_at is null) $$;
create or replace function public.trace_behaviors_without_tests() returns jsonb language sql stable set search_path = public as $$
  select public._list('behaviors_without_tests', jsonb_agg(public.graph_node_json(b))) from public.objects b
  where b.type = 'BehaviorStatement' and not b.is_tombstone and b.lifecycle_state not in ('draft','proposed','rejected','superseded')
    and not exists (select 1 from public.edges e join public.objects t on t.id = e.to_id and t.type = 'TestRun' and not t.is_tombstone
      where e.from_id = b.id and e.verb = 'verified_by' and e.retired_at is null) $$;
create or replace function public.trace_production_without_decision() returns jsonb language sql stable set search_path = public as $$
  select public._list('production_without_decision', jsonb_agg(public.graph_node_json(c))) from public._prod_caps() c
  where not exists (
    select 1 from public.edges e where e.retired_at is null and e.to_id = c.id and e.verb = 'references_capability' and public.decision_ancestor(e.from_id) is not null
    union all
    select 1 from public.edges b join public.edges x on x.to_id = b.from_id and x.verb = 'executed_as' and x.retired_at is null
      join public.edges p on p.to_id = x.from_id and p.verb = 'compiled_into' and p.retired_at is null
      where b.to_id = c.id and b.verb = 'built' and b.retired_at is null and public.decision_ancestor(p.from_id) is not null) $$;
create or replace function public.trace_expired_exposures() returns jsonb language sql stable set search_path = public as $$
  select public._list('expired_exposures', jsonb_agg(public.graph_node_json(a) || jsonb_build_object('effective_to', a.body->>'effective_to'))) from public.objects a
  where a.type = 'ExposureAuthorization' and not a.is_tombstone and a.body->>'effective_to' ~ '^\d{4}-\d{2}-\d{2}'
    and (a.body->>'effective_to')::timestamptz < now()
    and not exists (select 1 from public.edges e join public.objects d on d.id = e.from_id and d.type = 'ConfirmedDecision' and not d.is_tombstone
      where e.to_id = a.id and e.verb = 'renews' and e.retired_at is null) $$;
create or replace function public.trace_incident_to_decision(p_incident uuid) returns jsonb language plpgsql stable set search_path = public as $$
declare c jsonb;
begin
  if not exists (select 1 from public.objects where id = p_incident and type = 'Incident') then raise exception 'WRONG_TYPE: start from an Incident'; end if;
  c := public.evidence_chain(p_incident);
  return jsonb_build_object('query', 'incident_to_decision', 'incident', c->'root',
    'chain', (select jsonb_agg(x order by (x->>'hop')::int desc) from jsonb_array_elements(c->'links') x where x->>'link' in ('outcome','implement','behavior','decision','signal')),
    'capabilities', c->'capabilities', 'reaches_decision', exists (select 1 from jsonb_array_elements(c->'links') x where x->>'link' = 'decision' and jsonb_array_length(x->'objects') > 0));
end $$;
create or replace function public.trace_retirement_impact(p_capability uuid) returns jsonb language plpgsql stable set search_path = public as $$
begin
  if not exists (select 1 from public.objects where id = p_capability and type = 'ComposableCapability') then raise exception 'WRONG_TYPE: start from a Composable Capability'; end if;
  return public.graph_closure(p_capability, 6) || jsonb_build_object('query', 'retirement_impact',
    'compositions', public._chain_obj(public._rev('composes', array[p_capability])),
    'dependents', public._chain_obj(public._rev('depends_on', array[p_capability]) || public._rev('references_capability', array[p_capability])));
end $$;
create or replace function public.trace_full_chain(p_id uuid) returns jsonb language sql stable set search_path = public as $$
  select public.evidence_chain(p_id) || jsonb_build_object('query', 'full_chain', 'completeness', public.chain_completeness(p_id)) $$;

create index if not exists objects_type_state_live on public.objects (type, lifecycle_state) where not is_tombstone;
create index if not exists objects_body_source_decision on public.objects ((body->>'source_decision_ref')) where type = 'BehaviorStatement';

grant execute on function public.evidence_chain(uuid), public.chain_completeness(uuid), public.explain_capability(uuid, text), public.explain_capability_all(uuid),
  public.trace_blast_radius(uuid), public.trace_canon_change_impact(uuid), public.trace_value_without_owner(), public.trace_production_without_value(interval),
  public.trace_behaviors_without_tests(), public.trace_production_without_decision(), public.trace_expired_exposures(), public.trace_incident_to_decision(uuid),
  public.trace_retirement_impact(uuid), public.trace_full_chain(uuid), public.can_reach_creation(uuid), public.decision_ancestor(uuid) to authenticated, service_role;

insert into public.tool_contracts (name, contract, version) values
 ('explain_capability', '{"input":{"id":"uuid","question":["authority","decision","evidence","version","tests","exposure","outcome","value","justification"]},"output":"answer with citations","budget_ms":300,"sql":"explain_capability"}', '1'),
 ('chain_completeness', '{"input":{"id":"uuid"},"output":"present and missing links","budget_ms":300,"sql":"chain_completeness"}', '1'),
 ('trace_blast_radius', '{"input":{"behavior_id":"uuid"},"budget_ms":800,"sql":"trace_blast_radius"}', '1'),
 ('trace_canon_change_impact', '{"input":{"id":"uuid"},"budget_ms":800,"sql":"trace_canon_change_impact"}', '1'),
 ('trace_value_without_owner', '{"input":{},"budget_ms":1000,"sql":"trace_value_without_owner"}', '1'),
 ('trace_production_without_value', '{"input":{"period":"interval"},"budget_ms":1000,"sql":"trace_production_without_value"}', '1'),
 ('trace_behaviors_without_tests', '{"input":{},"budget_ms":1000,"sql":"trace_behaviors_without_tests"}', '1'),
 ('trace_production_without_decision', '{"input":{},"budget_ms":1000,"sql":"trace_production_without_decision"}', '1'),
 ('trace_expired_exposures', '{"input":{},"budget_ms":1000,"sql":"trace_expired_exposures"}', '1'),
 ('trace_incident_to_decision', '{"input":{"incident_id":"uuid"},"budget_ms":1000,"sql":"trace_incident_to_decision"}', '1'),
 ('trace_retirement_impact', '{"input":{"capability_id":"uuid"},"budget_ms":800,"sql":"trace_retirement_impact"}', '1'),
 ('trace_full_chain', '{"input":{"id":"uuid"},"budget_ms":1500,"sql":"trace_full_chain"}', '1')
on conflict (name) do update set contract = excluded.contract, version = excluded.version;

create or replace function public._selftest_body(_type text, _refs jsonb) returns jsonb language sql stable set search_path = public as $$
  select case
    when _type = 'ExtractedStatement' then '{"provenance_spans":[{"kind":"char_range","start":0,"end":1}],"classification":"suggestion","material":false,"speaker_authority":{"decision":false}}'::jsonb
    when _type in ('NeedStatement','DependencyProposal','EvidenceRequirement','Persona','Situation')
      then '{"provenance_spans":[{"kind":"char_range","start":0,"end":1}]}'::jsonb
    when _type = 'FramingSession' then '{"entry_test_result":{"completed":false,"sentence":null}}'::jsonb
    when _type = 'CoCreationArtifact' then jsonb_build_object('session_ref', _refs->>'session', 'kind', 'chat')
    when _type = 'HumanDecisionRequest' then jsonb_build_object('exact_decision_required','self-test','reason_ai_cannot_safely_decide','self-test',
      'current_evidence_and_confidence', _refs->>'evidence','ai_recommendation','self-test','viable_alternatives','[{"option":"a","consequences":"none","affected_parties":[]}]'::jsonb,
      'affected_parties','[]'::jsonb,'deadline', now() + interval '1 day','cost_of_waiting','none','reversibility','reversible',
      'current_authority_boundary', _refs->>'evidence','proposed_next_machine_action','none')
    when _type = 'Decision' then jsonb_build_object('request_ref', _refs->>'hdr', 'response', 'decide', 'decision', 'self-test')
    when _type = 'ConfirmedDecision' then jsonb_build_object('signal_ref', _refs->>'session')
    when _type in ('CreationPrompt','BuildRun') then jsonb_build_object('reuse_check_ref', _refs->>'reuse_check')
    else '{}'::jsonb end $$;

create or replace function public._selftest_next_state(_family text, _from text) returns text language sql stable set search_path = public as $$
  select to_state from public.lifecycle_transitions where lifecycle_family = _family and from_state = _from
  order by (to_state in ('capturing','limited_exposure','producing_value')), to_state limit 1 $$;
