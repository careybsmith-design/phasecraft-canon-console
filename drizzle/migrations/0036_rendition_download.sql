create or replace function public.thread_record_rendition_download(p_actor jsonb, p_id uuid, p_purpose text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r jsonb; cls text; s bigint;
begin
  r := public.thread_serve_rendition(p_actor, p_id, p_purpose);
  select coalesce(max(ob.data_classification::text) filter (where ob.data_classification::text = 'restricted'),
                  max(ob.data_classification::text) filter (where ob.data_classification::text = 'confidential'),
                  max(ob.data_classification::text) filter (where ob.data_classification::text = 'internal'), 'public')
    into cls from public.objects ob where ob.id in (select (e->>'id')::uuid from jsonb_array_elements(r->'generated_from') e);
  s := public._rendition_ledger(p_actor, 'rendition.downloaded', 'none',
    jsonb_build_object('rendition_id', p_id, 'human_ref', r->>'human_ref', 'purpose', p_purpose, 'format', 'pdf',
      'classification', cls, 'expires_at', r->>'expires_at', 'generated_from', r->'generated_from'));
  return jsonb_build_object('rendition', r, 'classification', cls, 'ledger_seq', s, 'downloaded_at', now());
end $$;
revoke all on function public.thread_record_rendition_download(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.thread_record_rendition_download(jsonb, uuid, text) to service_role;