-- 0074 is already the SI-1 self-test; this additive follow-up is the next migration.
drop policy if exists intake_read on public.signal_intake_events;
create policy intake_read on public.signal_intake_events for select to authenticated
using (public._is_current_member(auth.uid()) and public.can_read_object('{}'::jsonb, data_classification));

-- Exercise SELECT under authenticated RLS, not an administrator bypass or a predicate-only test.
-- Invoker rights intentionally allow a privileged test runner to SET ROLE; never SECURITY DEFINER.
create or replace function public.thread_intake_read_selftest() returns jsonb
language plpgsql security invoker as $$
declare
  member_id uuid;
  steward_id uuid;
  internal_id uuid := gen_random_uuid();
  restricted_id uuid := gen_random_uuid();
  prohibited_id uuid := gen_random_uuid();
  member_restricted integer;
  member_internal integer;
  steward_both integer;
  steward_prohibited integer;
  result jsonb;
begin
  select r.user_id into member_id from public.user_roles r
  where r.role = 'member' and not exists (
    select 1 from public.user_roles elevated where elevated.user_id=r.user_id and elevated.role in ('steward','compliance'))
  order by r.user_id limit 1;
  select r.user_id into steward_id from public.user_roles r where r.role='steward' order by r.user_id limit 1;
  if member_id is null or steward_id is null then
    raise exception 'INTAKE_READ_FIXTURE_IDENTITIES_REQUIRED';
  end if;
  begin
    insert into public.signal_intake_events(id,origin,status,source_ref,raw_input_ref,submitted_by,extraction_method,data_classification)
    values
      (internal_id,'human_expertise','rejected','selftest:internal','selftest:no-content','{"kind":"system","id":"intake-read-selftest"}','selftest','internal'),
      (restricted_id,'human_expertise','rejected','selftest:restricted','selftest:no-content','{"kind":"system","id":"intake-read-selftest"}','selftest','restricted'),
      (prohibited_id,'human_expertise','rejected','selftest:prohibited','selftest:no-content','{"kind":"system","id":"intake-read-selftest"}','selftest','prohibited');
    perform set_config('request.jwt.claim.sub',member_id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    select count(*) into member_restricted from public.signal_intake_events where id=restricted_id;
    select count(*) into member_internal from public.signal_intake_events where id=internal_id;
    execute 'reset role';
    perform set_config('request.jwt.claim.sub',steward_id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',steward_id,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    select count(*) into steward_both from public.signal_intake_events where id in (internal_id,restricted_id);
    select count(*) into steward_prohibited from public.signal_intake_events where id=prohibited_id;
    execute 'reset role';
    result := jsonb_build_object('member_restricted',member_restricted,'member_internal',member_internal,
      'steward_internal_and_restricted',steward_both,'steward_prohibited',steward_prohibited,
      'all_ok',member_restricted=0 and member_internal=1 and steward_both=2 and steward_prohibited=0);
    raise exception using errcode='TT001',message='SELFTEST_ROLLBACK';
  exception when sqlstate 'TT001' then null;
  end;
  return result;
end $$;
revoke all on function public.thread_intake_read_selftest() from public, anon, authenticated;
grant execute on function public.thread_intake_read_selftest() to service_role;
comment on function public.thread_intake_read_selftest() is 'Privileged rollback-only regression runner: actual authenticated-role intake SELECTs using existing member/steward identities; no content or identities returned. Invoker rights, never SECURITY DEFINER.';
do $$
declare r jsonb;
begin
  r := public.thread_intake_read_selftest();
  if r->>'all_ok' is distinct from 'true' then raise exception 'INTAKE_READ_SELFTEST_FAILED: %',r; end if;
  raise notice 'INTAKE_READ_SELFTEST: %',r;
end $$;