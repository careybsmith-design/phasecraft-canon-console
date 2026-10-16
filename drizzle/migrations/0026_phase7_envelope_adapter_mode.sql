-- The Phase 2B guard requires the envelope's top-level adapter_mode to agree with body.provenance.simulated (3.4).
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
    'data_classification', 'internal', 'rationale', p_rationale,
    'adapter_mode', case when coalesce(p_body->'provenance'->>'simulated','false') = 'true' then 'simulated'
                         else coalesce(p_body->>'adapter_mode','none') end)
$$;