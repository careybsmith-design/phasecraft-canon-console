create or replace function public.thread_phase6_selftest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; res jsonb; ok boolean; msg text;
begin
  r := public._thread_phase6_selftest_v1();
  select coalesce(jsonb_agg(e), '[]') into res from jsonb_array_elements(r->'checks') e where e->>'name' <> 'Confidential content is never routed to Lovable (8.3)';
  select ('confidential' = any(cleared_classes)) and not ('restricted' = any(cleared_classes)), array_to_string(cleared_classes, ',') into ok, msg
    from public.build_platforms where platform = 'lovable';
  ok := coalesce(ok, false) and not exists (select 1 from public.build_platforms where 'restricted' = any(cleared_classes));
  res := res || jsonb_build_object('name', 'Lovable is cleared up to confidential; restricted goes to no builder (8.3, confirmed 16 Oct 2026)', 'pass', ok, 'detail', 'lovable: ' || coalesce(msg, 'missing'));
  return jsonb_build_object('passed', not exists (select 1 from jsonb_array_elements(res) x where not (x->>'pass')::boolean), 'checks', res, 'fixtures', 'rolled back');
end $$;