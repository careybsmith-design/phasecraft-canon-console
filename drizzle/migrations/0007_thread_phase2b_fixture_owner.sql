
create or replace function public._fx_payload(_type text, _title text, _body jsonb) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('type', _type, 'title', _title, 'statement', _title, 'machine_description', 'Phase 2B self-test fixture',
    'body', _body, 'review_date', (current_date + 30)::text, 'expiration_condition', jsonb_build_object('kind', 'review_date_passes'),
    'retirement_path', jsonb_build_object('mode', 'tombstone'), 'risk_tier', '1',
    'owner_id', (select ur.user_id from public.user_roles ur where ur.role = 'steward' order by ur.user_id limit 1),
    'permission', jsonb_build_object('roles', '[]'::jsonb, 'purpose', 'phase2b self-test'), 'data_classification', 'internal',
    'rationale', 'Phase 2B self-test fixture')
$$;
