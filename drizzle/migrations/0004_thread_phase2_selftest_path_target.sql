-- The pathfinding check targeted an object 10 hops away, beyond the bounded 6-hop search. Target one 4 hops away instead.
do $do$
declare src text;
begin
  select p.prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'thread_phase2_selftest';
  src := replace(src, 'public.graph_paths(n3.id, canon_ids[cardinality(canon_ids)], 6, 10)', 'public.graph_paths(n3.id, canon_ids[3], 6, 10)');
  execute 'create or replace function public.thread_phase2_selftest() returns jsonb language plpgsql security definer set search_path = public as $fn$' || src || '$fn$';
end $do$;
revoke execute on function public.thread_phase2_selftest() from public, anon, authenticated;
grant execute on function public.thread_phase2_selftest() to service_role;
