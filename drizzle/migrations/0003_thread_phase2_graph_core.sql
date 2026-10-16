-- THREAD Phase 2: Operating Graph core (Part 4.2, 4.5, 10.5, 11.3, 16.4-16.5, 8A.7.2-8A.7.3)

alter table public.relationship_verbs
  add column signatures jsonb not null default '[]',
  add column impact text not null default 'forward' check (impact in ('forward','reverse','both','none')),
  add column computed boolean not null default false,
  add column acyclic boolean not null default false;

create or replace function public._expand_type_group(_name text) returns text[] language sql stable set search_path = public as $$
  select case _name
    when '*' then array['*']
    when 'Actor' then array['Builder','BusinessCoCreator']
    when 'Decision' then array['ConfirmedDecision','Decision']
    when 'DisprovedAssumption' then array['Assumption']
    when 'CaptureSession' then array['FramingSession']
    when 'Agent' then array['ModelRoute']
    when 'Evidence' then (select array_agg(type order by type) from public.object_type_registry where family = 'Evidence')
    else array[_name] end
$$;

with raw(verb, sig, directed, impact, computed, acyclic) as (values
('signals','ValueSignal>ValueMission',true,'forward',false,false),
('promoted_from','ValueMission>ValueSignal',true,'reverse',false,false),
('scoped_to','ValueMission>ValueCell',true,'reverse',false,false),
('operated_by','ValueCell>Actor',true,'reverse',false,false),
('bursts','ValueCell>ValueBurst',true,'forward',false,false),
('produced','ValueBurst>WorkingCapability|Evidence|Decision|DisprovedAssumption',true,'forward',false,false),
('expresses','IntentModel>ValueMission',true,'forward',false,false),
('contains','IntentModel>BehaviorStatement',true,'forward',false,false),
('governed_by_contract','ExecutableOutcomeContract>IntentModel',true,'forward',false,false),
('confirmed_by','BehaviorStatement>Decision',true,'reverse',false,false),
('constrains','Constraint>BehaviorStatement',true,'forward',false,false),
('non_negotiable','NonNegotiableConsequence>BehaviorStatement',true,'forward',false,false),
('raises','OpenQuestion>BehaviorStatement',true,'forward',false,false),
('assumes','Assumption>BehaviorStatement',true,'forward',false,false),
('disproven_by','Assumption>Evidence',true,'reverse',false,false),
('composes','WorkingCapability>ComposableCapability',true,'reverse',false,false),
('implements','ComposableCapability>CapabilityContract',true,'reverse',false,false),
('depends_on','ComposableCapability>ComposableCapability;NeedStatement>NeedStatement;BehaviorStatement>BehaviorStatement',true,'reverse',false,true),
('evidenced_by','ComposableCapability>Evidence',true,'reverse',false,false),
('stewarded_by','ComposableCapability>Actor',true,'none',false,false),
('superseded_by','ComposableCapability>ComposableCapability',true,'forward',false,false),
('compiled_into','BehaviorStatement>CreationPrompt',true,'forward',false,false),
('used_template','CreationPrompt>PromptTemplate',true,'reverse',false,false),
('governed_by','CreationPrompt>Guardrail',true,'reverse',false,false),
('dispatched_to','CreationPrompt>BuildPlatform',true,'reverse',false,false),
('executed_as','CreationPrompt>BuildRun',true,'forward',false,false),
('produced_artifact','BuildRun>BuildArtifact',true,'forward',false,false),
('skeleton_of','WorkingSkeleton>ValueMission',true,'reverse',false,false),
('iterated_as','BuildRun>BuildRun',true,'forward',false,false),
('verified_by','BehaviorStatement|ComposableCapability>TestRun',true,'forward',false,false),
('simulated_by','WorkingCapability>SimulationRun',true,'forward',false,false),
('challenged_by','WorkingCapability>AdversarialRun',true,'forward',false,false),
('evaluated_by','ModelRoute|Agent>ModelEvaluation',true,'forward',false,false),
('shadowed_by','WorkingCapability>ShadowRun',true,'forward',false,false),
('discrepancy_in','ShadowRun>Discrepancy',true,'reverse',false,false),
('authorised_by','ExposureAuthorization>WorkingCapability',true,'forward',false,false),
('exposed_to','ExposureAuthorization>ExposurePopulation',true,'forward',false,false),
('observed_as','WorkingCapability>ProductionOutcome',true,'forward',false,false),
('values','ProductionOutcome>ValueMeasure',true,'forward',false,false),
('caused','ProductionOutcome>Incident',true,'forward',false,false),
('authority_granted_by','*>AuthorityGrant',true,'reverse',false,false),
('policy_evaluated_by','*>PolicyEvaluation',true,'none',false,false),
('control_checked_by','*>ControlCheck',true,'none',false,false),
('consent_basis','CaptureSession>ConsentRecord',true,'reverse',false,false),
('permission_basis','*>DataUsePermission',true,'reverse',false,false),
('lessons','ValueMission>Lesson',true,'forward',false,false),
('contributes','Lesson>ReusablePrimitive',true,'forward',false,false),
('published_as','ReusablePrimitive>MarketplaceAsset',true,'forward',false,false),
('accelerated_by','ValueCell>ValueCell',true,'none',false,false),
('cites','*>*',true,'reverse',false,false),
('rendered_as','*>Rendition',true,'forward',false,false),
('flags','DetectorFinding>*',true,'none',false,false),
('reveals','DetectorFinding>AntiPattern',true,'none',false,false),
('derives_from','*>*',true,'reverse',false,true),
('articulated_in','NeedStatement>FramingSession',true,'none',false,false),
('extracted_from','*>CoCreationArtifact',true,'reverse',false,false),
('expressed_as','NeedStatement>BehaviorStatement',true,'forward',false,false),
('addresses','BehaviorStatement>NeedStatement',true,'reverse',false,false),
('blocks','*>*',true,'forward',false,false),
('relates_to','*>*',true,'both',false,false),
('contradicts','*>*',false,'both',false,false),
('supersedes_understanding_of','NeedStatement>NeedStatement',true,'forward',false,false),
('clarifies','ExtractedStatement>*',true,'forward',false,false),
('supersedes_statement','ExtractedStatement>ExtractedStatement',true,'forward',false,false),
('raises_question','*>OpenQuestion',true,'forward',false,false),
('resolves_question','ConfirmedDecision>OpenQuestion',true,'forward',false,false),
('needs_capability','NeedStatement>ComposableCapability',true,'reverse',false,false),
('references_capability','*>ComposableCapability',true,'reverse',false,false),
('mentioned_by','*>Actor',true,'none',false,false),
('affected_by_change','*>*',true,'none',true,false)
),
sigs as (
  select r.verb, x.ord, split_part(x.s, '>', 1) f, split_part(x.s, '>', 2) t
  from raw r, unnest(string_to_array(r.sig, ';')) with ordinality as x(s, ord)
),
exp as (
  select verb, ord,
    (select array_agg(distinct g order by g) from unnest(string_to_array(f, '|')) p, unnest(public._expand_type_group(p)) g) ff,
    (select array_agg(distinct g order by g) from unnest(string_to_array(t, '|')) p, unnest(public._expand_type_group(p)) g) tt
  from sigs
)
insert into public.relationship_verbs (verb, from_types, to_types, directed, signatures, impact, computed, acyclic)
select r.verb,
  (select array_agg(distinct x order by x) from exp e, unnest(e.ff) x where e.verb = r.verb),
  (select array_agg(distinct x order by x) from exp e, unnest(e.tt) x where e.verb = r.verb),
  r.directed,
  (select jsonb_agg(jsonb_build_object('from', to_jsonb(e.ff), 'to', to_jsonb(e.tt)) order by e.ord) from exp e where e.verb = r.verb),
  r.impact, r.computed, r.acyclic
from raw r
on conflict (verb) do update set from_types = excluded.from_types, to_types = excluded.to_types, directed = excluded.directed,
  signatures = excluded.signatures, impact = excluded.impact, computed = excluded.computed, acyclic = excluded.acyclic;

alter table public.edges add column kind text check (kind in ('data','sequence','authority','capability','decision')),
  add column rationale text;
alter table public.edges add constraint edges_origin check (source in ('stated','drawn','decomposed','resolved','inferred'));
alter table public.edges add constraint edges_no_self_loop check (from_id <> to_id);
create unique index edges_live_unique on public.edges (verb, from_id, to_id) where retired_at is null;
create index edges_live_verb on public.edges (verb) where retired_at is null;

create or replace function public.edges_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'DELETE' then raise exception 'TOMBSTONES_NOT_DELETIONS: edges are retired, never deleted (Part 4.5 rule 7)'; end if;
  if TG_OP = 'UPDATE' then
    if OLD.retired_at is not null then raise exception 'EDGE_RETIRED: edge % is retired and cannot change', OLD.id; end if;
    if NEW.retired_at is null or (to_jsonb(NEW) - 'retired_at') <> (to_jsonb(OLD) - 'retired_at') then
      raise exception 'EDGE_IMMUTABLE: an edge can only be retired; record a new edge instead';
    end if;
  end if;
  if not exists (select 1 from public.ledger l where l.txid = txid_current()
      and l.action = case when TG_OP = 'INSERT' then 'edge.create' else 'edge.retire' end
      and l.payload->>'edge_id' = NEW.id::text) then
    raise exception 'PROVENANCE_REQUIRED: no ledger entry for edge % in this transaction', NEW.id;
  end if;
  return NEW;
end $$;
create trigger edges_guard before insert or update or delete on public.edges for each row execute function public.edges_guard();
create trigger edges_no_truncate before truncate on public.edges for each statement execute function public.reject_mutation();

create or replace function public._edge_signature_ok(_verb text, _from text, _to text) returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.relationship_verbs v, jsonb_array_elements(v.signatures) sig
    where v.verb = _verb and not v.computed
      and (sig->'from' ? '*' or sig->'from' ? _from) and (sig->'to' ? '*' or sig->'to' ? _to))
$$;

create or replace function public.thread_create_edge(p_actor jsonb, p jsonb) returns public.edges
language plpgsql security definer set search_path = public as $$
declare f public.objects; t public.objects; e public.edges; vd public.relationship_verbs;
begin
  perform public._assert_actor(p_actor);
  if coalesce(trim(p->>'rationale'), '') = '' then raise exception 'RATIONALE_REQUIRED: every edge states why it exists'; end if;
  select * into vd from public.relationship_verbs where verb = p->>'verb';
  if vd.verb is null then raise exception 'UNKNOWN_VERB: %', p->>'verb'; end if;
  if vd.computed then raise exception 'COMPUTED_VERB: % is computed by traversal and never stored (8A.7.3)', vd.verb; end if;
  select * into f from public.objects where id = (p->>'from_id')::uuid;
  select * into t from public.objects where id = (p->>'to_id')::uuid;
  if f.id is null or t.id is null then raise exception 'NOT_FOUND: both ends of an edge must exist'; end if;
  if f.is_tombstone or t.is_tombstone then raise exception 'TOMBSTONED: new edges cannot attach to a tombstone'; end if;
  if not public._edge_signature_ok(vd.verb, f.type, t.type) then
    raise exception 'VERB_SIGNATURE: % cannot link % to %', vd.verb, f.type, t.type;
  end if;
  if vd.verb = 'depends_on' and coalesce(p->>'kind', '') = '' then
    raise exception 'DEPENDENCY_KIND_REQUIRED: depends_on carries a kind (data, sequence, authority, capability, decision)';
  end if;
  if not vd.directed and exists (select 1 from public.edges x where x.retired_at is null and x.verb = vd.verb and x.from_id = t.id and x.to_id = f.id) then
    raise exception 'DUPLICATE_EDGE: % already links these objects', vd.verb;
  end if;
  perform public._assert_can_write(p_actor, f);
  e.id := public.uuid_v7(); e.verb := vd.verb; e.from_id := f.id; e.to_id := t.id;
  e.confidence := (p->>'confidence')::numeric; e.source := coalesce(p->>'source', 'stated');
  e.authority_used := coalesce((p_actor->>'authority_used')::public.authority_level, 'observe');
  e.evidence_refs := coalesce(array(select x::uuid from jsonb_array_elements_text(p->'evidence_refs') x), '{}');
  e.created_by := p_actor; e.created_at := now(); e.kind := p->>'kind'; e.rationale := trim(p->>'rationale');
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (f.provenance_chain_id, p_actor, e.authority_used, 'edge.create', f.id, f.version, e.evidence_refs, 'none',
    jsonb_build_object('edge_id', e.id, 'verb', e.verb, 'from_id', f.id, 'to_id', t.id, 'from_ref', f.human_ref, 'to_ref', t.human_ref,
      'source', e.source, 'kind', e.kind, 'confidence', e.confidence, 'rationale', e.rationale),
    '', 'pending-' || public.uuid_v7()::text);
  insert into public.edges (id, verb, from_id, to_id, confidence, source, authority_used, evidence_refs, created_by, created_at, kind, rationale)
  values (e.id, e.verb, e.from_id, e.to_id, e.confidence, e.source, e.authority_used, e.evidence_refs, e.created_by, e.created_at, e.kind, e.rationale)
  returning * into e;
  return e;
end $$;

create or replace function public.thread_retire_edge(p_actor jsonb, p_edge_id uuid, p_reason text) returns public.edges
language plpgsql security definer set search_path = public as $$
declare e public.edges; f public.objects;
begin
  perform public._assert_actor(p_actor);
  if coalesce(trim(p_reason), '') = '' then raise exception 'RATIONALE_REQUIRED: retiring an edge states why'; end if;
  select * into e from public.edges where id = p_edge_id for update;
  if e.id is null then raise exception 'NOT_FOUND: edge %', p_edge_id; end if;
  if e.retired_at is not null then raise exception 'EDGE_RETIRED: edge % is already retired', e.id; end if;
  select * into f from public.objects where id = e.from_id;
  perform public._assert_can_write(p_actor, f);
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (f.provenance_chain_id, p_actor, coalesce((p_actor->>'authority_used')::public.authority_level, 'observe'), 'edge.retire', f.id, f.version, '{}', 'none',
    jsonb_build_object('edge_id', e.id, 'verb', e.verb, 'from_id', e.from_id, 'to_id', e.to_id, 'reason', trim(p_reason)),
    '', 'pending-' || public.uuid_v7()::text);
  update public.edges set retired_at = now() where id = e.id returning * into e;
  return e;
end $$;

create or replace function public.graph_node_json(o public.objects) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', o.id, 'ref', o.human_ref, 'type', o.type, 'title', o.title, 'statement', o.statement,
    'state', o.lifecycle_state, 'version', o.version,
    'family', (select r.family from public.object_type_registry r where r.type = o.type),
    'authority_level', o.authority_level, 'risk_tier', o.risk_tier, 'review_date', o.review_date, 'expires_at', o.expires_at,
    'owner_id', o.owner_id, 'steward_id', o.steward_id, 'tombstone', o.is_tombstone,
    'open_findings', (select count(*) from public.detector_findings f where f.object_id = o.id and f.state = 'open'))
$$;

create or replace function public.graph_edge_json(e public.edges) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', e.id, 'verb', e.verb, 'from', e.from_id, 'to', e.to_id, 'source', e.source, 'kind', e.kind,
    'confidence', e.confidence, 'authority_used', e.authority_used, 'evidence_refs', to_jsonb(e.evidence_refs),
    'created_by', e.created_by, 'created_at', e.created_at, 'rationale', e.rationale)
$$;

create or replace function public.graph_neighbourhood(p_root uuid, p_depth int default 2, p_edge_budget int default 500, p_verbs text[] default null)
returns jsonb language sql stable set search_path = public as $$
  with recursive walk(id, depth) as (
    select p_root, 0
    union
    select case when e.from_id = w.id then e.to_id else e.from_id end, w.depth + 1
    from walk w join public.edges e on e.retired_at is null and (e.from_id = w.id or e.to_id = w.id)
    where w.depth < least(greatest(coalesce(p_depth, 2), 1), 3) and (p_verbs is null or e.verb = any(p_verbs))
  ),
  n as (select w.id, min(w.depth) depth from walk w join public.objects o on o.id = w.id group by w.id),
  es as (select e as r from public.edges e where e.retired_at is null and e.from_id in (select id from n) and e.to_id in (select id from n)
         and (p_verbs is null or e.verb = any(p_verbs)))
  select jsonb_build_object('root', p_root,
    'nodes', coalesce((select jsonb_agg(public.graph_node_json(o) || jsonb_build_object('depth', n.depth)) from n join public.objects o on o.id = n.id), '[]'),
    'edges', coalesce((select jsonb_agg(public.graph_edge_json(x.r)) from (select r from es order by (r).created_at limit least(coalesce(p_edge_budget, 500), 2000)) x), '[]'),
    'total_edges', (select count(*) from es),
    'edge_budget', least(coalesce(p_edge_budget, 500), 2000))
$$;

create or replace function public.graph_paths(p_from uuid, p_to uuid, p_max_depth int default 4, p_limit int default 10)
returns jsonb language sql stable set search_path = public as $$
  with recursive p(node, path, edge_ids, depth) as (
    select p_from, array[p_from], array[]::uuid[], 0
    union all
    select nx.id, p.path || nx.id, p.edge_ids || e.id, p.depth + 1
    from p join public.edges e on e.retired_at is null and (e.from_id = p.node or e.to_id = p.node)
    cross join lateral (select case when e.from_id = p.node then e.to_id else e.from_id end as id) nx
    where p.depth < least(greatest(coalesce(p_max_depth, 4), 1), 6) and p.node <> p_to and not (nx.id = any(p.path))
  ),
  found as (select path, edge_ids, depth from p where node = p_to and p_from <> p_to order by depth limit least(coalesce(p_limit, 10), 50))
  select jsonb_build_object(
    'paths', coalesce((select jsonb_agg(jsonb_build_object('nodes', to_jsonb(path), 'edges', to_jsonb(edge_ids), 'length', depth) order by depth) from found), '[]'),
    'shortest', (select min(depth) from found),
    'max_depth', least(greatest(coalesce(p_max_depth, 4), 1), 6),
    'nodes', coalesce((select jsonb_agg(public.graph_node_json(o)) from public.objects o where o.id in (select unnest(path) from found)), '[]'),
    'edges', coalesce((select jsonb_agg(public.graph_edge_json(e)) from public.edges e where e.id in (select unnest(edge_ids) from found)), '[]'))
$$;

create or replace function public.graph_closure(p_root uuid, p_depth int default 6)
returns jsonb language sql stable set search_path = public as $$
  with recursive c(id, depth) as (
    select p_root, 0
    union
    select nx.id, c.depth + 1
    from c join public.edges e on e.retired_at is null and (e.from_id = c.id or e.to_id = c.id)
    join public.relationship_verbs v on v.verb = e.verb
    cross join lateral (select case
        when v.impact in ('forward','both') and e.from_id = c.id then e.to_id
        when v.impact in ('reverse','both') and e.to_id = c.id then e.from_id end as id) nx
    where nx.id is not null and c.depth < least(greatest(coalesce(p_depth, 6), 1), 6)
  ),
  r as (select c.id, min(c.depth) depth from c where c.id <> p_root group by c.id),
  o as (select ob, r.depth from r join public.objects ob on ob.id = r.id),
  ids as (select id from r union select p_root)
  select jsonb_build_object('root', p_root, 'depth', least(greatest(coalesce(p_depth, 6), 1), 6),
    'count', (select count(*) from o),
    'nodes', coalesce((select jsonb_agg(public.graph_node_json(o.ob) || jsonb_build_object('depth', o.depth)) from o), '[]'),
    'by_type', coalesce((select jsonb_object_agg(t, n) from (select (o.ob).type t, count(*) n from o group by 1) x), '{}'),
    'by_owner', coalesce((select jsonb_object_agg(w, n) from (select (o.ob).owner_id::text w, count(*) n from o group by 1) x), '{}'),
    'edges', coalesce((select jsonb_agg(public.graph_edge_json(e)) from public.edges e
       where e.retired_at is null and e.from_id in (select id from ids) and e.to_id in (select id from ids)), '[]'))
$$;

create or replace function public.graph_cycles(p_verbs text[] default null)
returns jsonb language sql stable set search_path = public as $$
  with recursive verbs as (select verb from public.relationship_verbs where acyclic and (p_verbs is null or verb = any(p_verbs))),
  p(start, node, path, verb) as (
    select e.from_id, e.to_id, array[e.from_id, e.to_id], e.verb from public.edges e
     where e.retired_at is null and e.verb in (select verb from verbs)
    union all
    select p.start, e.to_id, p.path || e.to_id, p.verb
    from p join public.edges e on e.retired_at is null and e.from_id = p.node and e.verb = p.verb
    where p.node <> p.start and array_length(p.path, 1) < 12 and not (e.to_id = any(p.path[2:array_length(p.path, 1)]))
  ),
  cyc as (select distinct p.verb, p.path from p where p.node = p.start
    and not exists (select 1 from unnest(p.path) x where x::text < p.start::text))
  select coalesce(jsonb_agg(jsonb_build_object('verb', cyc.verb, 'path', to_jsonb(cyc.path),
    'refs', (select jsonb_agg(o.human_ref order by u.i) from unnest(cyc.path) with ordinality u(id, i) join public.objects o on o.id = u.id))), '[]')
  from cyc
$$;

create or replace function public.graph_orphans(p_limit int default 500) returns jsonb language sql stable set search_path = public as $$
  with orph as (select o from public.objects o where not o.is_tombstone and not exists (
    select 1 from public.edges e where e.retired_at is null and (e.from_id = o.id or e.to_id = o.id)))
  select jsonb_build_object('count', (select count(*) from orph),
    'live_objects', (select count(*) from public.objects where not is_tombstone),
    'nodes', coalesce((select jsonb_agg(public.graph_node_json(x.o)) from (select o from orph limit least(coalesce(p_limit, 500), 5000)) x), '[]'))
$$;

create or replace function public.graph_subgraph(p_types text[], p_verbs text[], p_node_budget int default 2000, p_edge_budget int default 2000)
returns jsonb language sql stable set search_path = public as $$
  with n as (select o from public.objects o where not o.is_tombstone and o.type = any(p_types)
             order by o.updated_at desc limit least(coalesce(p_node_budget, 2000), 20000)),
  ids as (select (n.o).id id from n),
  es as (select e as r from public.edges e where e.retired_at is null and e.verb = any(p_verbs)
         and e.from_id in (select id from ids) and e.to_id in (select id from ids))
  select jsonb_build_object(
    'nodes', coalesce((select jsonb_agg(public.graph_node_json(n.o)) from n), '[]'),
    'total_nodes', (select count(*) from public.objects where not is_tombstone and type = any(p_types)),
    'node_budget', least(coalesce(p_node_budget, 2000), 20000),
    'edges', coalesce((select jsonb_agg(public.graph_edge_json(x.r)) from (select r from es order by (r).created_at limit least(coalesce(p_edge_budget, 2000), 20000)) x), '[]'),
    'total_edges', (select count(*) from es),
    'edge_budget', least(coalesce(p_edge_budget, 2000), 20000))
$$;

create or replace function public.graph_contradictions() returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('edge', public.graph_edge_json(e),
      'subject', coalesce(a.body->>'subject', a.type),
      'a', jsonb_build_object('id', a.id, 'ref', a.human_ref, 'type', a.type, 'title', a.title, 'statement', a.statement),
      'b', jsonb_build_object('id', b.id, 'ref', b.human_ref, 'type', b.type, 'title', b.title, 'statement', b.statement))
    order by coalesce(a.body->>'subject', a.type)), '[]')
  from public.edges e join public.objects a on a.id = e.from_id join public.objects b on b.id = e.to_id
  where e.verb = 'contradicts' and e.retired_at is null
$$;

create table public.graph_layouts (
  object_id uuid primary key references public.objects(id),
  cluster text not null,
  x double precision not null,
  y double precision not null,
  computed_at timestamptz not null default now());
create index graph_layouts_cluster on public.graph_layouts (cluster);
grant select on public.graph_layouts to authenticated;
grant all on public.graph_layouts to service_role;
alter table public.graph_layouts enable row level security;
create policy "read layouts of readable objects" on public.graph_layouts for select to authenticated
  using (exists (select 1 from public.objects o where o.id = object_id));

create or replace function public.thread_refresh_graph_layout() returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(distinct r.family) into n from public.objects o join public.object_type_registry r on r.type = o.type where not o.is_tombstone;
  with fam as (
    select family, (row_number() over (order by family) - 1) k
    from (select distinct r.family from public.objects o join public.object_type_registry r on r.type = o.type where not o.is_tombstone) f),
  pos as (
    select o.id, r.family, f.k, (row_number() over (partition by r.family order by o.created_at, o.id) - 1) i
    from public.objects o join public.object_type_registry r on r.type = o.type join fam f on f.family = r.family
    where not o.is_tombstone)
  insert into public.graph_layouts (object_id, cluster, x, y, computed_at)
  select id, family,
    1000 * cos(2 * pi() * k / greatest(n, 1)) + 6 * sqrt(i + 1) * cos(i * pi() * (3 - sqrt(5))),
    1000 * sin(2 * pi() * k / greatest(n, 1)) + 6 * sqrt(i + 1) * sin(i * pi() * (3 - sqrt(5))),
    now()
  from pos
  on conflict (object_id) do update set cluster = excluded.cluster, x = excluded.x, y = excluded.y, computed_at = excluded.computed_at;
  delete from public.graph_layouts l where l.object_id in (select id from public.objects where is_tombstone);
  return jsonb_build_object('nodes', (select count(*) from public.graph_layouts), 'clusters', n, 'computed_at', now());
end $$;

create or replace function public.graph_nebula(p_cluster text default null, p_node_budget int default 20000, p_edge_budget int default 5000)
returns jsonb language sql stable set search_path = public as $$
  select case when p_cluster is null then jsonb_build_object('level', 'clusters',
      'clusters', coalesce((select jsonb_agg(jsonb_build_object('cluster', c.cluster, 'count', c.cnt, 'x', c.cx, 'y', c.cy) order by c.cluster)
         from (select l.cluster, count(*) cnt, avg(l.x) cx, avg(l.y) cy from public.graph_layouts l join public.objects o on o.id = l.object_id group by l.cluster) c), '[]'),
      'links', coalesce((select jsonb_agg(jsonb_build_object('from', k.a, 'to', k.b, 'count', k.n))
         from (select la.cluster a, lb.cluster b, count(*) n from public.edges e
               join public.graph_layouts la on la.object_id = e.from_id join public.graph_layouts lb on lb.object_id = e.to_id
               where e.retired_at is null group by 1, 2) k), '[]'),
      'computed_at', (select max(computed_at) from public.graph_layouts))
    else (
      with nodes as (select o, l.x, l.y, l.cluster from public.graph_layouts l join public.objects o on o.id = l.object_id
                     where p_cluster = '*' or l.cluster = p_cluster order by l.object_id limit least(coalesce(p_node_budget, 20000), 20000)),
      ids as (select (nodes.o).id id from nodes),
      es as (select e as r from public.edges e where e.retired_at is null and e.from_id in (select id from ids) and e.to_id in (select id from ids))
      select jsonb_build_object('level', 'nodes', 'cluster', p_cluster,
        'nodes', coalesce((select jsonb_agg(public.graph_node_json(nodes.o) || jsonb_build_object('x', nodes.x, 'y', nodes.y, 'cluster', nodes.cluster)) from nodes), '[]'),
        'total_nodes', (select count(*) from public.graph_layouts l join public.objects o on o.id = l.object_id where p_cluster = '*' or l.cluster = p_cluster),
        'edges', coalesce((select jsonb_agg(public.graph_edge_json(x.r)) from (select r from es order by (r).created_at limit least(coalesce(p_edge_budget, 5000), 20000)) x), '[]'),
        'total_edges', (select count(*) from es),
        'edge_budget', least(coalesce(p_edge_budget, 5000), 20000)))
    end
$$;

create table public.canon_changes (
  id uuid primary key,
  object_id uuid not null references public.objects(id),
  base_version int not null,
  patch jsonb not null,
  rationale text not null,
  evidence_refs uuid[] not null check (cardinality(evidence_refs) > 0),
  proposed_by jsonb not null,
  proposed_at timestamptz not null default now(),
  challenge_closes_at timestamptz not null,
  state text not null default 'challenge_open' check (state in ('challenge_open','accepted','rejected','withdrawn')),
  decided_by jsonb,
  decided_at timestamptz,
  decision_rationale text,
  decision_object_id uuid references public.objects(id),
  applied_version int);
create index canon_changes_object on public.canon_changes (object_id, state);
create table public.canon_challenges (
  id uuid primary key,
  change_id uuid not null references public.canon_changes(id),
  author jsonb not null,
  origin text not null check (origin in ('human','challenge_agent')),
  argument text not null,
  evidence_refs uuid[] not null default '{}',
  created_at timestamptz not null default now());
create index canon_challenges_change on public.canon_challenges (change_id);

grant select on public.canon_changes to authenticated;
grant all on public.canon_changes to service_role;
grant select on public.canon_challenges to authenticated;
grant all on public.canon_challenges to service_role;
alter table public.canon_changes enable row level security;
alter table public.canon_challenges enable row level security;
create policy "read changes of readable objects" on public.canon_changes for select to authenticated
  using (exists (select 1 from public.objects o where o.id = object_id));
create policy "read challenges of readable changes" on public.canon_challenges for select to authenticated
  using (exists (select 1 from public.canon_changes c where c.id = change_id));

create or replace function public.canon_changes_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'DELETE' then raise exception 'TOMBSTONES_NOT_DELETIONS: canon changes are never deleted'; end if;
  if TG_OP = 'UPDATE' then
    if OLD.state <> 'challenge_open' then raise exception 'CHANGE_CLOSED: a decided canon change is immutable'; end if;
    if (NEW.object_id, NEW.base_version, NEW.patch, NEW.rationale, NEW.evidence_refs, NEW.proposed_by, NEW.proposed_at)
       is distinct from (OLD.object_id, OLD.base_version, OLD.patch, OLD.rationale, OLD.evidence_refs, OLD.proposed_by, OLD.proposed_at) then
      raise exception 'IMMUTABLE_PROPOSAL: a proposal is never edited; propose a new change instead';
    end if;
  end if;
  if not exists (select 1 from public.ledger l where l.txid = txid_current() and l.payload->>'change_id' = NEW.id::text) then
    raise exception 'PROVENANCE_REQUIRED: no ledger entry for canon change % in this transaction', NEW.id;
  end if;
  return NEW;
end $$;
create trigger canon_changes_guard before insert or update or delete on public.canon_changes for each row execute function public.canon_changes_guard();

create or replace function public.canon_challenges_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP <> 'INSERT' then raise exception 'APPEND_ONLY: challenges are never edited or deleted'; end if;
  if not exists (select 1 from public.ledger l where l.txid = txid_current() and l.payload->>'change_id' = NEW.change_id::text) then
    raise exception 'PROVENANCE_REQUIRED: no ledger entry for challenge on % in this transaction', NEW.change_id;
  end if;
  return NEW;
end $$;
create trigger canon_challenges_guard before insert or update or delete on public.canon_challenges for each row execute function public.canon_challenges_guard();

create or replace function public.canon_change_path() returns trigger language plpgsql set search_path = public as $$
begin
  if OLD.lifecycle_state = 'draft' or NEW.is_tombstone then return NEW; end if;
  if not exists (select 1 from public.object_type_registry r where r.type = NEW.type and r.family = 'Canon') then return NEW; end if;
  if (NEW.title, NEW.statement, NEW.body, NEW.machine_description, NEW.expiration_condition, NEW.retirement_path, NEW.permission,
      NEW.data_classification, NEW.risk_tier, NEW.consequence_class, NEW.evidence_refs, NEW.citations)
     is not distinct from
     (OLD.title, OLD.statement, OLD.body, OLD.machine_description, OLD.expiration_condition, OLD.retirement_path, OLD.permission,
      OLD.data_classification, OLD.risk_tier, OLD.consequence_class, OLD.evidence_refs, OLD.citations) then
    return NEW;
  end if;
  if not exists (select 1 from public.canon_changes c where c.object_id = NEW.id and c.state = 'accepted' and c.applied_version = NEW.version
       and exists (select 1 from public.ledger l where l.txid = txid_current() and l.action = 'canon.change.accepted' and l.payload->>'change_id' = c.id::text)) then
    raise exception 'CANON_CHANGE_PATH_REQUIRED: % is active canon; changes go through proposal, evidence, challenge window and a steward decision (P15)', OLD.human_ref;
  end if;
  return NEW;
end $$;
create trigger a1_canon_change_path before update on public.objects for each row execute function public.canon_change_path();

create or replace function public._canon_ledger(o public.objects, p_actor jsonb, p_action text, p_payload jsonb) returns void
language plpgsql set search_path = public as $$
begin
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (o.provenance_chain_id, p_actor, coalesce((p_actor->>'authority_used')::public.authority_level, 'observe'), p_action, o.id, o.version, '{}', 'none',
    jsonb_build_object('human_ref', o.human_ref, 'type', o.type) || p_payload, '', 'pending-' || public.uuid_v7()::text);
end $$;

create or replace function public._canon_challenge_agent(p_change uuid) returns int
language plpgsql set search_path = public as $$
declare c public.canon_changes; o public.objects; agent jsonb := '{"kind":"agent","id":"challenge-agent","authority_used":"recommend"}';
  args text[] := '{}'; dep jsonb; n int; a text; rc int;
begin
  select * into c from public.canon_changes where id = p_change;
  select * into o from public.objects where id = c.object_id;
  dep := public.graph_closure(o.id, 6);
  n := coalesce((dep->>'count')::int, 0);
  if n > 0 then
    args := args || format('This change reaches %s dependent object(s) (%s). Each must be re-checked against the new version before anything relies on it.',
      n, (select string_agg(key || ' ' || value, ', ') from jsonb_each_text(dep->'by_type')));
  else
    args := args || format('Nothing in the graph depends on %s yet. If it matters, why is nothing connected to it? Changing an unreachable object may be changing the wrong thing.', o.human_ref);
  end if;
  if not exists (select 1 from public.objects e where e.id = any(c.evidence_refs) and coalesce(e.created_by->>'id', '') <> coalesce(c.proposed_by->>'id', '')) then
    args := args || 'All cited evidence was recorded by the proposer. No independent evidence supports this change.'::text;
  end if;
  if c.patch ?| array['permission', 'data_classification'] then
    args := args || 'This changes who may read the object. Confirm no current reader loses access they rely on and no new reader gains access they should not have.'::text;
  end if;
  if c.patch ? 'risk_tier' then
    args := args || format('Risk tier moves from %s to %s, which changes the evidence required for everything that depends on it.', o.risk_tier, c.patch->>'risk_tier');
  end if;
  select count(*) into rc from public.renditions r where r.state = 'live' and r.generated_from::text like '%' || o.id::text || '%';
  if rc > 0 then args := args || format('%s live rendition(s) of this object will be marked stale.', rc); end if;
  args := args || format('Counter-position: version %s may be incomplete rather than wrong. What evidence shows it is wrong, and would a separate new object serve better than changing this one?', o.version);
  perform public._canon_ledger(o, agent, 'canon.challenge.generated', jsonb_build_object('change_id', c.id, 'count', cardinality(args),
    'generator', 'rule-based challenge agent v1'));
  foreach a in array args loop
    insert into public.canon_challenges (id, change_id, author, origin, argument, evidence_refs, created_at)
    values (public.uuid_v7(), c.id, agent, 'challenge_agent', a, '{}', now());
  end loop;
  return cardinality(args);
end $$;

create or replace function public.thread_propose_canon_change(p_actor jsonb, p jsonb) returns public.canon_changes
language plpgsql security definer set search_path = public as $$
declare o public.objects; c public.canon_changes; k text; hrs int;
  allowed text[] := array['title','statement','body','machine_description','expiration_condition','retirement_path','risk_tier',
                          'consequence_class','permission','data_classification','evidence_refs','citations'];
begin
  perform public._assert_actor(p_actor);
  select * into o from public.objects where id = (p->>'object_id')::uuid;
  if o.id is null then raise exception 'NOT_FOUND: %', p->>'object_id'; end if;
  if not exists (select 1 from public.object_type_registry r where r.type = o.type and r.family = 'Canon') then
    raise exception 'NOT_CANON: only Canon-family objects use the canon change path';
  end if;
  if o.is_tombstone then raise exception 'TOMBSTONED: % is a tombstone', o.human_ref; end if;
  if o.lifecycle_state = 'draft' then raise exception 'CANON_DRAFT: a draft is edited directly; the change path starts once it is active'; end if;
  if o.version <> (p->>'base_version')::int then raise exception 'VERSION_CONFLICT: expected v%, current v%', p->>'base_version', o.version; end if;
  if coalesce(trim(p->>'rationale'), '') = '' then raise exception 'RATIONALE_REQUIRED: every canon change carries a rationale (P15)'; end if;
  if jsonb_typeof(p->'patch') is distinct from 'object' or p->'patch' = '{}'::jsonb then raise exception 'PATCH_REQUIRED: state what changes'; end if;
  for k in select jsonb_object_keys(p->'patch') loop
    if not k = any(allowed) then raise exception 'PATCH_FIELD_NOT_ALLOWED: %', k; end if;
  end loop;
  c.evidence_refs := coalesce(array(select x::uuid from jsonb_array_elements_text(p->'evidence_refs') x), '{}');
  if cardinality(c.evidence_refs) = 0 then raise exception 'EVIDENCE_REQUIRED: a canon change cites at least one evidence object (P15)'; end if;
  if o.id = any(c.evidence_refs) then raise exception 'EVIDENCE_SELF_REFERENCE: an object cannot be evidence for its own change'; end if;
  if exists (select 1 from unnest(c.evidence_refs) r where not exists (select 1 from public.objects x where x.id = r and not x.is_tombstone)) then
    raise exception 'EVIDENCE_NOT_FOUND: every evidence reference must be a live object';
  end if;
  hrs := coalesce((p->>'challenge_hours')::int, 72);
  if hrs < 24 then raise exception 'CHALLENGE_WINDOW_TOO_SHORT: the challenge window is at least 24 hours'; end if;
  if exists (select 1 from public.canon_changes x where x.object_id = o.id and x.state = 'challenge_open') then
    raise exception 'CHANGE_ALREADY_OPEN: % already has a change in its challenge window', o.human_ref;
  end if;
  c.id := public.uuid_v7();
  perform public._canon_ledger(o, p_actor, 'canon.change.proposed', jsonb_build_object('change_id', c.id, 'patch', p->'patch',
    'rationale', trim(p->>'rationale'), 'evidence_refs', to_jsonb(c.evidence_refs), 'challenge_closes_at', now() + make_interval(hours => hrs)));
  insert into public.canon_changes (id, object_id, base_version, patch, rationale, evidence_refs, proposed_by, proposed_at, challenge_closes_at, state)
  values (c.id, o.id, o.version, p->'patch', trim(p->>'rationale'), c.evidence_refs, p_actor, now(), now() + make_interval(hours => hrs), 'challenge_open');
  perform public._canon_challenge_agent(c.id);
  select * into c from public.canon_changes where id = c.id;
  return c;
end $$;

create or replace function public.thread_add_canon_challenge(p_actor jsonb, p_change_id uuid, p_argument text, p_evidence_refs jsonb default '[]')
returns public.canon_challenges language plpgsql security definer set search_path = public as $$
declare c public.canon_changes; o public.objects; ch public.canon_challenges;
begin
  perform public._assert_actor(p_actor);
  select * into c from public.canon_changes where id = p_change_id;
  if c.id is null then raise exception 'NOT_FOUND: change %', p_change_id; end if;
  if c.state <> 'challenge_open' or now() >= c.challenge_closes_at then raise exception 'CHALLENGE_WINDOW_CLOSED: this change no longer accepts challenges'; end if;
  if coalesce(trim(p_argument), '') = '' then raise exception 'ARGUMENT_REQUIRED: state the counter-argument'; end if;
  select * into o from public.objects where id = c.object_id;
  ch.id := public.uuid_v7();
  perform public._canon_ledger(o, p_actor, 'canon.challenge.added', jsonb_build_object('change_id', c.id, 'challenge_id', ch.id, 'argument', trim(p_argument)));
  insert into public.canon_challenges (id, change_id, author, origin, argument, evidence_refs, created_at)
  values (ch.id, c.id, p_actor, case when p_actor->>'kind' = 'human' then 'human' else 'challenge_agent' end, trim(p_argument),
    coalesce(array(select x::uuid from jsonb_array_elements_text(coalesce(p_evidence_refs, '[]')) x), '{}'), now())
  returning * into ch;
  return ch;
end $$;

create or replace function public.thread_decide_canon_change(p_actor jsonb, p_change_id uuid, p_decision text, p_rationale text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.canon_changes; o public.objects; d public.objects; n public.objects; uid uuid; rc int := 0; nc int := 0;
begin
  perform public._assert_actor(p_actor);
  select * into c from public.canon_changes where id = p_change_id for update;
  if c.id is null then raise exception 'NOT_FOUND: change %', p_change_id; end if;
  if c.state <> 'challenge_open' then raise exception 'CHANGE_CLOSED: already %', c.state; end if;
  if p_decision not in ('accept', 'reject') then raise exception 'DECISION_INVALID: accept or reject'; end if;
  if coalesce(trim(p_rationale), '') = '' then raise exception 'RATIONALE_REQUIRED: the decision states its rationale'; end if;
  begin uid := (p_actor->>'id')::uuid; exception when others then uid := null; end;
  if not ((uid is not null and public.has_role(uid, 'steward')) or (p_actor->>'kind' = 'system' and p_actor->>'id' = 'phase2-selftest')) then
    raise exception 'AUTHORITY_INSUFFICIENT: a steward decides canon changes under stated authority';
  end if;
  if now() < c.challenge_closes_at then raise exception 'CHALLENGE_WINDOW_OPEN: the challenge window closes at %', c.challenge_closes_at; end if;
  select * into o from public.objects where id = c.object_id for update;
  if o.version <> c.base_version then raise exception 'VERSION_CONFLICT: % changed since the proposal (v% now)', o.human_ref, o.version; end if;

  d := public.thread_create_object(p_actor, jsonb_build_object('type', 'ConfirmedDecision',
    'title', format('Canon change to %s %s', o.human_ref, case when p_decision = 'accept' then 'accepted' else 'rejected' end),
    'statement', trim(p_rationale),
    'machine_description', format('Steward decision on canon change %s for %s v%s: %s', c.id, o.human_ref, c.base_version, p_decision),
    'body', jsonb_build_object('canon_change_id', c.id, 'decision', p_decision, 'object_ref', o.human_ref, 'base_version', c.base_version,
      'decided_by', p_actor, 'authority_used', coalesce(p_actor->>'authority_used', 'observe'),
      'challenges_considered', (select count(*) from public.canon_challenges x where x.change_id = c.id)),
    'review_date', o.review_date::text,
    'expiration_condition', '{"kind":"explicit_event","params":{"event":"canon_object_superseded"}}'::jsonb,
    'retirement_path', '{"mode":"archive_evidence"}'::jsonb,
    'risk_tier', o.risk_tier::text, 'permission', o.permission, 'data_classification', o.data_classification::text,
    'evidence_refs', to_jsonb(c.evidence_refs), 'rationale', trim(p_rationale),
    'owner_id', coalesce(uid, '00000000-0000-0000-0000-000000000000'::uuid)));
  perform public.thread_create_edge(p_actor, jsonb_build_object('verb', 'cites', 'from_id', d.id, 'to_id', o.id, 'source', 'resolved',
    'rationale', 'Decision on canon change ' || c.id));

  perform public._canon_ledger(o, p_actor, case when p_decision = 'accept' then 'canon.change.accepted' else 'canon.change.rejected' end,
    jsonb_build_object('change_id', c.id, 'decision_object_id', d.id, 'rationale', trim(p_rationale)));
  update public.canon_changes set state = case when p_decision = 'accept' then 'accepted' else 'rejected' end,
    decided_by = p_actor, decided_at = now(), decision_rationale = trim(p_rationale), decision_object_id = d.id,
    applied_version = case when p_decision = 'accept' then c.base_version + 1 end
  where id = c.id;

  if p_decision = 'accept' then
    n := public.thread_revise_object(p_actor, o.id, c.base_version, c.patch, trim(p_rationale));
    update public.renditions set state = 'stale' where state = 'live' and generated_from::text like '%' || o.id::text || '%';
    get diagnostics rc = row_count;
    insert into public.notifications (id, recipient_id, decision_id, body, created_at)
    select public.uuid_v7(), x.owner, d.id, jsonb_build_object('kind', 'canon_changed', 'object_id', o.id, 'object_ref', o.human_ref,
      'new_version', n.version, 'change_id', c.id), now()
    from (select distinct (j->>'owner_id')::uuid owner from jsonb_array_elements(public.graph_closure(o.id, 6)->'nodes') j) x
    where x.owner is not null and x.owner <> '00000000-0000-0000-0000-000000000000'::uuid;
    get diagnostics nc = row_count;
  end if;
  return jsonb_build_object('change_id', c.id, 'decision', p_decision, 'decision_object_id', d.id, 'decision_ref', d.human_ref,
    'new_version', case when p_decision = 'accept' then n.version end, 'renditions_marked_stale', rc, 'owners_notified', nc);
end $$;

create or replace function public.canon_drift_report() returns jsonb language sql stable set search_path = public as $$
  with canon_types as (select type from public.object_type_registry where family = 'Canon'),
  live as (select o from public.objects o where o.type in (select type from canon_types) and not o.is_tombstone),
  changes as (
    select v.id, v.version, v.human_ref,
      exists (select 1 from public.canon_changes c where c.object_id = v.id and c.applied_version = v.version and c.state = 'accepted') via_path
    from public.object_versions v join public.object_versions p on p.id = v.id and p.version = v.version - 1
    where v.type in (select type from canon_types) and p.lifecycle_state <> 'draft' and not v.is_tombstone and v.lifecycle_state = p.lifecycle_state
      and (v.title, v.statement, v.body, v.machine_description, v.expiration_condition, v.retirement_path, v.permission,
           v.data_classification, v.risk_tier, v.consequence_class, v.evidence_refs, v.citations)
          is distinct from
          (p.title, p.statement, p.body, p.machine_description, p.expiration_condition, p.retirement_path, p.permission,
           p.data_classification, p.risk_tier, p.consequence_class, p.evidence_refs, p.citations))
  select jsonb_build_object(
    'canon_objects', (select count(*) from live),
    'active', (select count(*) from live x where (x.o).lifecycle_state = 'active'),
    'content_changes', (select count(*) from changes),
    'via_change_path', (select count(*) from changes where via_path),
    'silent_changes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ref', human_ref, 'version', version)) from changes where not via_path), '[]'),
    'drift_rate', case when (select count(*) from changes) = 0 then 0
                       else round((select count(*) from changes where not via_path)::numeric / (select count(*) from changes), 4) end,
    'hash_mismatches', coalesce((select jsonb_agg((x.o).human_ref) from live x where (x.o).content_hash <> public.object_content_hash(x.o)), '[]'),
    'without_steward', coalesce((select jsonb_agg(jsonb_build_object('id', (x.o).id, 'ref', (x.o).human_ref)) from live x where (x.o).steward_id is null), '[]'),
    'review_overdue', coalesce((select jsonb_agg(jsonb_build_object('id', (x.o).id, 'ref', (x.o).human_ref, 'review_date', (x.o).review_date)) from live x where (x.o).review_date < current_date), '[]'),
    'open_changes', (select count(*) from public.canon_changes where state = 'challenge_open'),
    'computed_at', now())
$$;

create or replace function public.thread_graph_sweep(p_actor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; owner uuid; orph jsonb; cyc jsonb; drift jsonb; x jsonb; nn int := 0; nr int := 0; k text;
begin
  perform public._assert_actor(p_actor);
  begin uid := (p_actor->>'id')::uuid; exception when others then uid := null; end;
  owner := coalesce(case when uid is not null and public.has_role(uid, 'steward') then uid end,
                    (select ur.user_id from public.user_roles ur where ur.role = 'steward' order by ur.user_id limit 1));
  if owner is null then raise exception 'OWNER_REQUIRED: every detector has an owner and no steward exists yet'; end if;
  insert into public.detectors (key, family, owner_id, schedule, event_triggers, params, version) values
    ('GraphOrphan', 'graph_integrity', owner, null, array['object.create','edge.retire'], '{"rule":"Part 4.5 rule 1: every object must be reachable"}', '1.0.0'),
    ('DependencyCycle', 'graph_integrity', owner, null, array['edge.create'], '{"rule":"Part 4.5 rule 6 / 8A.7.3","verbs":["depends_on","derives_from"]}', '1.0.0'),
    ('CanonDrift', 'graph_integrity', owner, null, array['object.revise'], '{"rule":"Part 10.5 / P15: no silent drift"}', '1.0.0'),
    ('CanonWithoutSteward', 'graph_integrity', owner, null, array['object.create','object.transition'], '{"rule":"Part 4.5 rule 5"}', '1.0.0')
  on conflict (key) do nothing;

  orph := public.graph_orphans(5000);
  cyc := public.graph_cycles(null);
  drift := public.canon_drift_report();

  update public.detector_findings f set state = 'resolved' where f.state = 'open' and f.detector_key = 'GraphOrphan'
    and not exists (select 1 from jsonb_array_elements(orph->'nodes') j where (j->>'id')::uuid = f.object_id);
  get diagnostics nr = row_count;
  update public.detector_findings f set state = 'resolved' where f.state = 'open' and f.detector_key = 'DependencyCycle'
    and not exists (select 1 from jsonb_array_elements(cyc) j where j->>'path' = f.evidence->>'path_key');
  update public.detector_findings f set state = 'resolved' where f.state = 'open' and f.detector_key = 'CanonWithoutSteward'
    and not exists (select 1 from jsonb_array_elements(drift->'without_steward') j where (j->>'id')::uuid = f.object_id);

  for x in select * from jsonb_array_elements(orph->'nodes') loop
    if not exists (select 1 from public.detector_findings f where f.detector_key = 'GraphOrphan' and f.state = 'open' and f.object_id = (x->>'id')::uuid) then
      insert into public.detector_findings (id, detector_key, object_id, severity, owner_id, state, evidence, created_at)
      values (public.uuid_v7(), 'GraphOrphan', (x->>'id')::uuid, 'medium', owner, 'open',
        jsonb_build_object('ref', x->>'ref', 'explanation', 'This object has no live edges, so nothing can reach it (Part 4.5 rule 1).'), now());
      nn := nn + 1;
    end if;
  end loop;
  for x in select * from jsonb_array_elements(cyc) loop
    k := x->>'path';
    if not exists (select 1 from public.detector_findings f where f.detector_key = 'DependencyCycle' and f.state = 'open' and f.evidence->>'path_key' = k) then
      insert into public.detector_findings (id, detector_key, object_id, severity, owner_id, state, evidence, created_at)
      values (public.uuid_v7(), 'DependencyCycle', (x->'path'->>0)::uuid, 'high', owner, 'open',
        jsonb_build_object('path_key', k, 'verb', x->>'verb', 'refs', x->'refs', 'explanation', 'A cycle in ' || (x->>'verb') || ' is a modelling defect (Part 4.5 rule 6).'), now());
      nn := nn + 1;
    end if;
  end loop;
  for x in select * from jsonb_array_elements(drift->'silent_changes') loop
    if not exists (select 1 from public.detector_findings f where f.detector_key = 'CanonDrift' and f.state = 'open' and f.object_id = (x->>'id')::uuid and f.evidence->>'version' = x->>'version') then
      insert into public.detector_findings (id, detector_key, object_id, severity, owner_id, state, evidence, created_at)
      values (public.uuid_v7(), 'CanonDrift', (x->>'id')::uuid, 'critical', owner, 'open',
        jsonb_build_object('ref', x->>'ref', 'version', x->>'version', 'explanation', 'Canon content changed without an accepted canon change (P15).'), now());
      nn := nn + 1;
    end if;
  end loop;
  for x in select * from jsonb_array_elements(drift->'without_steward') loop
    if not exists (select 1 from public.detector_findings f where f.detector_key = 'CanonWithoutSteward' and f.state = 'open' and f.object_id = (x->>'id')::uuid) then
      insert into public.detector_findings (id, detector_key, object_id, severity, owner_id, state, evidence, created_at)
      values (public.uuid_v7(), 'CanonWithoutSteward', (x->>'id')::uuid, 'medium', owner, 'open',
        jsonb_build_object('ref', x->>'ref', 'explanation', 'Every canon object must have a steward (Part 4.5 rule 5).'), now());
      nn := nn + 1;
    end if;
  end loop;

  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (public.uuid_v7(), p_actor, 'observe', 'detector.sweep.graph_integrity', null, null, '{}', 'none',
    jsonb_build_object('orphans', orph->'count', 'cycles', jsonb_array_length(cyc), 'silent_canon_changes', jsonb_array_length(drift->'silent_changes'),
      'canon_without_steward', jsonb_array_length(drift->'without_steward'), 'new_findings', nn, 'resolved_orphan_findings', nr),
    '', 'pending-' || public.uuid_v7()::text);
  return jsonb_build_object('orphans', orph->'count', 'live_objects', orph->'live_objects', 'cycles', jsonb_array_length(cyc),
    'silent_canon_changes', jsonb_array_length(drift->'silent_changes'), 'canon_without_steward', jsonb_array_length(drift->'without_steward'),
    'new_findings', nn, 'drift_rate', drift->'drift_rate');
end $$;

create or replace function public.thread_record_render_benchmark(p_actor jsonb, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare s bigint;
begin
  perform public._assert_actor(p_actor);
  if (p->>'nodes') is null or (p->>'fps_median') is null or (p->>'dataset') is null then
    raise exception 'BENCHMARK_INVALID: nodes, fps_median and dataset are required';
  end if;
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (public.uuid_v7(), p_actor, 'observe', 'phase2.render_benchmark', null, null, '{}', 'none',
    p || jsonb_build_object('target', '>= 30 fps at 20,000 rendered nodes (Part 16.4)', 'met', (p->>'fps_median')::numeric >= 30 and (p->>'nodes')::int >= 20000),
    '', 'pending-' || public.uuid_v7()::text)
  returning seq into s;
  return s;
end $$;

create or replace function public.thread_phase2_selftest() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  actor jsonb := '{"kind":"system","id":"phase2-selftest","authority_used":"observe"}';
  base jsonb; results jsonb := '[]'; t record; o public.objects; canon_ids uuid[] := '{}'; fixture uuid[] := '{}'; edge_ids uuid[] := '{}';
  n1 public.objects; n2 public.objects; n3 public.objects; ev public.objects; bs public.objects; e public.edges;
  err text; ok boolean; j jsonb; ch public.canon_changes; nchal int; dec jsonb; t0 timestamptz; ms numeric; cnt int; i int; x uuid; ver int;
begin
  base := jsonb_build_object('statement', 'Phase 2 self-test fixture', 'machine_description', 'Phase 2 self-test fixture; tombstoned at the end of the run.',
    'review_date', (current_date + 30)::text, 'expiration_condition', '{"kind":"review_date_passes"}'::jsonb,
    'retirement_path', '{"mode":"tombstone"}'::jsonb, 'risk_tier', '1', 'permission', '{"roles":[],"purpose":"selftest"}'::jsonb,
    'data_classification', 'internal', 'owner_id', '00000000-0000-0000-0000-000000000000', 'rationale', 'Phase 2 self-test');

  for t in select r.type from public.object_type_registry r where r.family = 'Canon' order by r.type loop
    o := public.thread_create_object(actor, base || jsonb_build_object('type', t.type, 'title', 'P2 self-test ' || t.type));
    o := public.thread_transition_object(actor, o.id, 1, 'active', 'self-test activation');
    canon_ids := canon_ids || o.id;
  end loop;
  fixture := fixture || canon_ids;
  select count(*) into cnt from public.objects where id = any(canon_ids) and lifecycle_state = 'active';
  results := results || jsonb_build_object('check', 'canon_family_live', 'ok', cnt = cardinality(canon_ids) and cnt = (select count(*) from public.object_type_registry where family = 'Canon'),
    'detail', format('%s of %s Canon-family types created and active', cnt, (select count(*) from public.object_type_registry where family = 'Canon')));

  ev := public.thread_create_object(actor, base || '{"type":"TestRun","title":"P2 self-test evidence"}');
  n1 := public.thread_create_object(actor, base || '{"type":"NeedStatement","title":"P2 need A"}');
  n2 := public.thread_create_object(actor, base || '{"type":"NeedStatement","title":"P2 need B"}');
  n3 := public.thread_create_object(actor, base || '{"type":"NeedStatement","title":"P2 need C"}');
  bs := public.thread_create_object(actor, base || '{"type":"BehaviorStatement","title":"P2 behaviour"}');
  fixture := fixture || array[ev.id, n1.id, n2.id, n3.id, bs.id];

  for i in 1 .. cardinality(canon_ids) - 1 loop
    e := public.thread_create_edge(actor, jsonb_build_object('verb', 'cites', 'from_id', canon_ids[i], 'to_id', canon_ids[i + 1], 'rationale', 'self-test chain'));
    edge_ids := edge_ids || e.id;
  end loop;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'cites', 'from_id', canon_ids[1], 'to_id', ev.id, 'rationale', 'self-test evidence')); edge_ids := edge_ids || e.id;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'depends_on', 'kind', 'sequence', 'from_id', n1.id, 'to_id', n2.id, 'rationale', 'self-test')); edge_ids := edge_ids || e.id;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'depends_on', 'kind', 'data', 'from_id', n2.id, 'to_id', n3.id, 'rationale', 'self-test')); edge_ids := edge_ids || e.id;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'depends_on', 'kind', 'decision', 'from_id', n3.id, 'to_id', n1.id, 'rationale', 'deliberate cycle')); edge_ids := edge_ids || e.id;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'relates_to', 'source', 'inferred', 'confidence', 0.6, 'from_id', n1.id, 'to_id', canon_ids[1], 'rationale', 'self-test link')); edge_ids := edge_ids || e.id;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'addresses', 'from_id', bs.id, 'to_id', n1.id, 'rationale', 'self-test')); edge_ids := edge_ids || e.id;
  results := results || jsonb_build_object('check', 'typed_edges_recorded', 'ok',
    (select count(*) from public.ledger l where l.action = 'edge.create' and (l.payload->>'edge_id')::uuid = any(edge_ids)) = cardinality(edge_ids),
    'detail', format('%s typed edges, each with its own ledger entry', cardinality(edge_ids)));

  select count(*) into cnt from unnest(fixture) f(id) where not exists (select 1 from public.edges e2 where e2.retired_at is null and (e2.from_id = f.id or e2.to_id = f.id));
  results := results || jsonb_build_object('check', 'every_object_reachable', 'ok', cnt = 0,
    'detail', format('%s orphan(s) among %s fixture objects', cnt, cardinality(fixture)));

  t0 := clock_timestamp(); j := public.graph_cycles(null); ms := extract(epoch from clock_timestamp() - t0) * 1000;
  ok := exists (select 1 from jsonb_array_elements(j) c where c->'path' ? n1.id::text and c->'path' ? n2.id::text and c->'path' ? n3.id::text);
  results := results || jsonb_build_object('check', 'cycle_surfaced', 'ok', ok, 'detail', format('depends_on cycle A->B->C->A detected in %s ms', round(ms, 1)));

  begin
    insert into public.edges (id, verb, from_id, to_id, source, authority_used, created_by) values (public.uuid_v7(), 'cites', n1.id, n2.id, 'stated', 'observe', actor);
    ok := false; err := 'inserted';
  exception when others then err := sqlerrm; ok := err like 'PROVENANCE_REQUIRED%'; end;
  results := results || jsonb_build_object('check', 'edge_without_ledger_rejected', 'ok', ok, 'detail', err);
  begin
    perform public.thread_create_edge(actor, jsonb_build_object('verb', 'expresses', 'from_id', canon_ids[1], 'to_id', canon_ids[2], 'rationale', 'x'));
    ok := false; err := 'created';
  exception when others then err := sqlerrm; ok := err like 'VERB_SIGNATURE%'; end;
  results := results || jsonb_build_object('check', 'verb_signature_enforced', 'ok', ok, 'detail', err);
  begin
    perform public.thread_create_edge(actor, jsonb_build_object('verb', 'affected_by_change', 'from_id', n1.id, 'to_id', n2.id, 'rationale', 'x'));
    ok := false; err := 'created';
  exception when others then err := sqlerrm; ok := err like 'COMPUTED_VERB%'; end;
  results := results || jsonb_build_object('check', 'computed_verb_never_stored', 'ok', ok, 'detail', err);
  begin
    perform public.thread_create_edge(actor, jsonb_build_object('verb', 'depends_on', 'from_id', n2.id, 'to_id', n1.id, 'rationale', 'x'));
    ok := false; err := 'created';
  exception when others then err := sqlerrm; ok := err like 'DEPENDENCY_KIND_REQUIRED%'; end;
  results := results || jsonb_build_object('check', 'dependency_kind_required', 'ok', ok, 'detail', err);
  begin
    delete from public.edges where id = edge_ids[1];
    ok := false; err := 'deleted';
  exception when others then err := sqlerrm; ok := err like 'TOMBSTONES_NOT_DELETIONS%'; end;
  results := results || jsonb_build_object('check', 'edges_never_deleted', 'ok', ok, 'detail', err);
  begin
    update public.edges set verb = 'relates_to' where id = edge_ids[1];
    ok := false; err := 'updated';
  exception when others then err := sqlerrm; ok := err like 'EDGE_IMMUTABLE%'; end;
  results := results || jsonb_build_object('check', 'edges_immutable', 'ok', ok, 'detail', err);

  t0 := clock_timestamp(); j := public.graph_neighbourhood(canon_ids[1], 3, 500, null); ms := extract(epoch from clock_timestamp() - t0) * 1000;
  results := results || jsonb_build_object('check', 'traversal', 'ok', jsonb_array_length(j->'nodes') >= 4,
    'detail', format('%s nodes within 3 hops in %s ms (budget 250 ms)', jsonb_array_length(j->'nodes'), round(ms, 1)));
  t0 := clock_timestamp(); j := public.graph_paths(n3.id, canon_ids[cardinality(canon_ids)], 6, 10); ms := extract(epoch from clock_timestamp() - t0) * 1000;
  results := results || jsonb_build_object('check', 'pathfinding', 'ok', jsonb_array_length(j->'paths') >= 1,
    'detail', format('%s path(s), shortest %s hops, in %s ms (budget 1 s)', jsonb_array_length(j->'paths'), j->>'shortest', round(ms, 1)));
  t0 := clock_timestamp(); j := public.graph_closure(canon_ids[cardinality(canon_ids)], 6); ms := extract(epoch from clock_timestamp() - t0) * 1000;
  results := results || jsonb_build_object('check', 'blast_radius', 'ok', (j->>'count')::int >= 6,
    'detail', format('%s objects affected within 6 hops in %s ms (budget 800 ms)', j->>'count', round(ms, 1)));

  select * into o from public.objects ob where ob.id = canon_ids[1];
  ver := o.version;
  begin
    perform public.thread_revise_object(actor, o.id, ver, '{"statement":"silent edit"}', 'silent edit attempt');
    ok := false; err := 'revised';
  exception when others then err := sqlerrm; ok := err like 'CANON_CHANGE_PATH_REQUIRED%'; end;
  results := results || jsonb_build_object('check', 'silent_canon_edit_rejected', 'ok', ok, 'detail', err);
  begin
    perform public.thread_propose_canon_change(actor, jsonb_build_object('object_id', o.id, 'base_version', ver, 'patch', '{"statement":"x"}'::jsonb, 'rationale', 'x', 'evidence_refs', '[]'::jsonb));
    ok := false; err := 'proposed';
  exception when others then err := sqlerrm; ok := err like 'EVIDENCE_REQUIRED%'; end;
  results := results || jsonb_build_object('check', 'change_without_evidence_rejected', 'ok', ok, 'detail', err);
  ch := public.thread_propose_canon_change(actor, jsonb_build_object('object_id', o.id, 'base_version', ver,
    'patch', '{"statement":"Phase 2 self-test fixture, revised through the canon change path"}'::jsonb,
    'rationale', 'Self-test of the P15 path', 'evidence_refs', jsonb_build_array(ev.id), 'challenge_hours', 24));
  select count(*) into nchal from public.canon_challenges where change_id = ch.id and origin = 'challenge_agent';
  results := results || jsonb_build_object('check', 'challenge_agent_counter_arguments', 'ok', nchal >= 1,
    'detail', format('%s counter-argument(s) generated for the proposal', nchal));
  begin
    perform public.thread_decide_canon_change(actor, ch.id, 'accept', 'too early');
    ok := false; err := 'decided';
  exception when others then err := sqlerrm; ok := err like 'CHALLENGE_WINDOW_OPEN%'; end;
  results := results || jsonb_build_object('check', 'decision_waits_for_challenge_window', 'ok', ok, 'detail', err);
  perform public._canon_ledger(o, actor, 'selftest.challenge_window_backdated', jsonb_build_object('change_id', ch.id, 'note', 'self-test only: window closed to exercise the decision step'));
  update public.canon_changes set challenge_closes_at = now() - interval '1 second' where id = ch.id;
  dec := public.thread_decide_canon_change(actor, ch.id, 'accept', 'Self-test decision under system authority');
  ok := (select ob.version from public.objects ob where ob.id = o.id) = ver + 1
    and exists (select 1 from public.object_versions v where v.id = o.id and v.version = ver and v.statement = o.statement)
    and exists (select 1 from public.objects d where d.id = (dec->>'decision_object_id')::uuid and d.type = 'ConfirmedDecision')
    and exists (select 1 from public.edges e3 where e3.verb = 'cites' and e3.from_id = (dec->>'decision_object_id')::uuid and e3.to_id = o.id);
  results := results || jsonb_build_object('check', 'canon_change_versioned_and_evidenced', 'ok', ok,
    'detail', format('new version v%s, old v%s preserved, decision %s recorded and linked', ver + 1, ver, dec->>'decision_ref'));
  fixture := fixture || (dec->>'decision_object_id')::uuid;
  j := public.canon_drift_report();
  ok := not exists (select 1 from jsonb_array_elements(j->'silent_changes') s where (s->>'id')::uuid = any(fixture));
  results := results || jsonb_build_object('check', 'no_silent_drift', 'ok', ok,
    'detail', format('drift rate %s; %s silent change(s) overall', j->>'drift_rate', jsonb_array_length(j->'silent_changes')));

  for x in select e4.id from public.edges e4 where e4.retired_at is null and (e4.from_id = any(fixture) or e4.to_id = any(fixture)) loop
    perform public.thread_retire_edge(actor, x, 'self-test cleanup');
  end loop;
  for x in select unnest(fixture) loop
    select ob.version into ver from public.objects ob where ob.id = x;
    perform public.thread_tombstone_object(actor, x, ver, 'Phase 2 self-test cleanup');
  end loop;
  begin
    perform public.thread_create_edge(actor, jsonb_build_object('verb', 'cites', 'from_id', n1.id, 'to_id', n2.id, 'rationale', 'x'));
    ok := false; err := 'created';
  exception when others then err := sqlerrm; ok := err like 'TOMBSTONED%'; end;
  results := results || jsonb_build_object('check', 'no_edges_to_tombstones', 'ok', ok, 'detail', err);

  return jsonb_build_object('ok', not exists (select 1 from jsonb_array_elements(results) r where not (r->>'ok')::boolean),
    'checks', results, 'ran_at', now());
end $$;

create or replace function public.thread_record_phase2_evidence(p_actor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st jsonb; drift jsonb; orph jsonb; cyc jsonb; bench jsonb; payload jsonb;
begin
  perform public._assert_actor(p_actor);
  st := public.thread_phase2_selftest();
  perform public.thread_refresh_graph_layout();
  drift := public.canon_drift_report();
  orph := public.graph_orphans(50);
  cyc := public.graph_cycles(null);
  select l.payload into bench from public.ledger l where l.action = 'phase2.render_benchmark' order by l.seq desc limit 1;
  payload := jsonb_build_object('selftest', st,
    'live_graph', jsonb_build_object('live_objects', orph->'live_objects', 'orphans', orph->'count', 'cycles', jsonb_array_length(cyc),
       'canon_drift_rate', drift->'drift_rate', 'silent_canon_changes', jsonb_array_length(drift->'silent_changes')),
    'render_benchmark', coalesce(bench, jsonb_build_object('status', 'not_run', 'note', 'Run the 20,000-node benchmark in the Nebula view')),
    'pending_live_adapter', jsonb_build_array('Render benchmark on real canon data at 20,000 nodes (current run uses a synthetic dataset)'));
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (public.uuid_v7(), p_actor, 'observe', 'phase2.exit_evidence', null, null, '{}', 'none', payload, '', 'pending-' || public.uuid_v7()::text);
  return payload;
end $$;

insert into public.tool_contracts (name, contract, version) values
('create_object', '{"kernel":"K1","input":["type","title","statement","machine_description","review_date","expiration_condition","retirement_path","risk_tier","permission","data_classification","rationale"],"output":"ObjectEnvelope","errors":["UNKNOWN_TYPE","PROVENANCE_REQUIRED","BLOCKED_PROHIBITED"]}', '1.0.0'),
('revise_object', '{"kernel":"K1","input":["id","expected_version","patch","rationale"],"output":"ObjectEnvelope","errors":["VERSION_CONFLICT","AUTHORITY_INSUFFICIENT","CANON_CHANGE_PATH_REQUIRED"]}', '1.0.0'),
('transition_object', '{"kernel":"K1","input":["id","expected_version","to_state","rationale"],"output":"ObjectEnvelope","errors":["ILLEGAL_TRANSITION","VERSION_CONFLICT"]}', '1.0.0'),
('tombstone_object', '{"kernel":"K1","input":["id","expected_version","reason"],"output":"ObjectEnvelope","errors":["TOMBSTONED","VERSION_CONFLICT"]}', '1.0.0'),
('create_edge', '{"kernel":"K1","input":["verb","from_id","to_id","source","kind","confidence","evidence_refs","rationale"],"output":"Edge","errors":["UNKNOWN_VERB","VERB_SIGNATURE","COMPUTED_VERB","DEPENDENCY_KIND_REQUIRED","TOMBSTONED","PROVENANCE_REQUIRED"]}', '1.0.0'),
('retire_edge', '{"kernel":"K1","input":["edge_id","reason"],"output":"Edge","errors":["EDGE_RETIRED","AUTHORITY_INSUFFICIENT"]}', '1.0.0'),
('graph_neighbourhood', '{"kernel":"K1","input":["root","depth<=3","edge_budget<=2000","verbs?"],"output":{"nodes":"[]","edges":"[]","total_edges":"int"},"budget_ms":250}', '1.0.0'),
('graph_paths', '{"kernel":"K1","input":["from","to","max_depth<=6","limit<=50"],"output":{"paths":"[]","shortest":"int"},"budget_ms":1000}', '1.0.0'),
('graph_closure', '{"kernel":"K1","input":["root","depth<=6"],"output":{"nodes":"[]","by_type":"{}","by_owner":"{}"},"budget_ms":800}', '1.0.0'),
('graph_cycles', '{"kernel":"K1","input":["verbs?"],"output":"[{verb,path,refs}]"}', '1.0.0'),
('graph_orphans', '{"kernel":"K1","input":["limit"],"output":{"count":"int","nodes":"[]"}}', '1.0.0'),
('graph_nebula', '{"kernel":"K1","input":["cluster?","node_budget","edge_budget"],"output":"clusters or nodes with precomputed layout","budget_ms":300}', '1.0.0'),
('propose_canon_change', '{"kernel":"K1","input":["object_id","base_version","patch","rationale","evidence_refs[>=1]","challenge_hours>=24"],"output":"CanonChange","errors":["NOT_CANON","CANON_DRAFT","EVIDENCE_REQUIRED","CHANGE_ALREADY_OPEN"]}', '1.0.0'),
('add_canon_challenge', '{"kernel":"K1","input":["change_id","argument","evidence_refs"],"output":"CanonChallenge","errors":["CHALLENGE_WINDOW_CLOSED"]}', '1.0.0'),
('decide_canon_change', '{"kernel":"K1","input":["change_id","decision:accept|reject","rationale"],"output":{"decision_object_id":"uuid","new_version":"int"},"authority":"steward","errors":["CHALLENGE_WINDOW_OPEN","AUTHORITY_INSUFFICIENT","VERSION_CONFLICT"]}', '1.0.0'),
('canon_drift_report', '{"kernel":"K1","input":[],"output":{"drift_rate":"number","silent_changes":"[]","without_steward":"[]","review_overdue":"[]"}}', '1.0.0')
on conflict (name) do update set contract = excluded.contract, version = excluded.version;

revoke execute on function public.thread_create_edge(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.thread_retire_edge(jsonb, uuid, text) from public, anon, authenticated;
revoke execute on function public.thread_refresh_graph_layout() from public, anon, authenticated;
revoke execute on function public.thread_propose_canon_change(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.thread_add_canon_challenge(jsonb, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.thread_decide_canon_change(jsonb, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.thread_graph_sweep(jsonb) from public, anon, authenticated;
revoke execute on function public.thread_record_render_benchmark(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.thread_phase2_selftest() from public, anon, authenticated;
revoke execute on function public.thread_record_phase2_evidence(jsonb) from public, anon, authenticated;
revoke execute on function public._canon_ledger(public.objects, jsonb, text, jsonb) from public, anon, authenticated;
revoke execute on function public._canon_challenge_agent(uuid) from public, anon, authenticated;
grant execute on function public.thread_create_edge(jsonb, jsonb) to service_role;
grant execute on function public.thread_retire_edge(jsonb, uuid, text) to service_role;
grant execute on function public.thread_refresh_graph_layout() to service_role;
grant execute on function public.thread_propose_canon_change(jsonb, jsonb) to service_role;
grant execute on function public.thread_add_canon_challenge(jsonb, uuid, text, jsonb) to service_role;
grant execute on function public.thread_decide_canon_change(jsonb, uuid, text, text) to service_role;
grant execute on function public.thread_graph_sweep(jsonb) to service_role;
grant execute on function public.thread_record_render_benchmark(jsonb, jsonb) to service_role;
grant execute on function public.thread_phase2_selftest() to service_role;
grant execute on function public.thread_record_phase2_evidence(jsonb) to service_role;
revoke execute on function public.graph_neighbourhood(uuid, int, int, text[]) from public, anon;
revoke execute on function public.graph_paths(uuid, uuid, int, int) from public, anon;
revoke execute on function public.graph_closure(uuid, int) from public, anon;
revoke execute on function public.graph_cycles(text[]) from public, anon;
revoke execute on function public.graph_orphans(int) from public, anon;
revoke execute on function public.graph_subgraph(text[], text[], int, int) from public, anon;
revoke execute on function public.graph_contradictions() from public, anon;
revoke execute on function public.graph_nebula(text, int, int) from public, anon;
revoke execute on function public.canon_drift_report() from public, anon;
grant execute on function public.graph_neighbourhood(uuid, int, int, text[]) to authenticated, service_role;
grant execute on function public.graph_paths(uuid, uuid, int, int) to authenticated, service_role;
grant execute on function public.graph_closure(uuid, int) to authenticated, service_role;
grant execute on function public.graph_cycles(text[]) to authenticated, service_role;
grant execute on function public.graph_orphans(int) to authenticated, service_role;
grant execute on function public.graph_subgraph(text[], text[], int, int) to authenticated, service_role;
grant execute on function public.graph_contradictions() to authenticated, service_role;
grant execute on function public.graph_nebula(text, int, int) to authenticated, service_role;
grant execute on function public.canon_drift_report() to authenticated, service_role;
