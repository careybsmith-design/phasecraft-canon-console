-- SI-1: exercise the real INSERT trigger, with ledger-valid fixtures and no persisted test rows.
create or replace function public.thread_signal_intake_selftest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor jsonb := jsonb_build_object('kind','system','id','00000000-0000-0000-0000-000000000000','authority_used','observe');
  signal public.objects;
  results jsonb := '[]'::jsonb;
  refs jsonb := '{}'::jsonb;
  ok boolean := false;
  err text;
  state text;
begin
  begin
    signal := public.thread_create_object(actor,
      public._fx_payload('ValueSignal', 'SI-1 rollback-only signal',
        public._selftest_body('ValueSignal', refs) || jsonb_build_object('observed_condition','SI-1 rollback-only condition'))
      || jsonb_build_object('owner_id',actor->>'id'));
    if signal.lifecycle_state is distinct from 'detected' then
      raise exception 'SI1_FIXTURE_INVALID: expected detected signal, got %', signal.lifecycle_state;
    end if;
    refs := jsonb_build_object('signal',signal.id);
    begin
      -- thread_create_object writes matching provenance before inserting into objects;
      -- a provenance failure or any unrelated guard error must NOT pass this test.
      perform public.thread_create_object(actor,
        public._fx_payload('ValueMission', 'SI-1 forbidden mission',
          public._selftest_body('ValueMission', refs) || jsonb_build_object('signal_ref',signal.id))
        || jsonb_build_object('owner_id',actor->>'id'));
      ok := false;
      err := 'ValueMission insert unexpectedly succeeded';
    exception when others then
      get stacked diagnostics err = MESSAGE_TEXT, state = RETURNED_SQLSTATE;
      ok := state = 'P0001' and err like 'MISSION_SIGNAL_NOT_PROMOTED:%';
    end;
    results := results || jsonb_build_object('check','SI-1_non_promoted_signal_mission_insert_rejected',
      'ok',ok,'signal_state',signal.lifecycle_state,'sqlstate',state,'detail',err);
    -- Roll back both fixtures and all ledger/version/layout/detector side effects.
    -- PL/pgSQL variables survive the subtransaction rollback, like phase1_selftest.
    raise exception using errcode = 'TT001', message = 'SELFTEST_ROLLBACK';
  exception when sqlstate 'TT001' then null;
  end;
  return jsonb_build_object('suite','signal_intake','ran_at',now(),
    'all_ok',jsonb_array_length(results) = 1 and not exists (
      select 1 from jsonb_array_elements(results) x where (x->>'ok')::boolean is distinct from true),
    'checks',results);
end $$;
revoke all on function public.thread_signal_intake_selftest() from public, anon, authenticated;
grant execute on function public.thread_signal_intake_selftest() to service_role;

-- Deployment assertion: an absent/bypassed trigger or an unrelated exception fails closed.
do $$
declare r jsonb;
begin
  r := public.thread_signal_intake_selftest();
  if r->>'all_ok' is distinct from 'true' then
    raise exception 'SI1_SELFTEST_FAILED: %', r;
  end if;
end $$;