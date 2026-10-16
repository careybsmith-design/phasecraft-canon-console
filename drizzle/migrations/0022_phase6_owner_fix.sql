do $do$
declare f text; def text;
begin
  -- creation-loop objects are owned by the owner of their source object, not by a system actor id
  def := pg_get_functiondef('public.thread_compile_creation_prompt(jsonb,jsonb)'::regprocedure);
  def := replace(def, $r$'type', 'CreationPrompt', 'title'$r$, $r$'type', 'CreationPrompt', 'owner_id', (select owner_id from public.objects where id = bids[1]), 'title'$r$);
  execute def;
  def := pg_get_functiondef('public.thread_dispatch_build(jsonb,jsonb)'::regprocedure);
  def := replace(def, $r$'type', 'BuildRun', 'title'$r$, $r$'type', 'BuildRun', 'owner_id', pr.owner_id, 'title'$r$);
  execute def;
  def := pg_get_functiondef('public.thread_record_build_result(jsonb,jsonb)'::regprocedure);
  def := replace(def, $r$'type', 'BuildArtifact', 'title'$r$, $r$'type', 'BuildArtifact', 'owner_id', run.owner_id, 'title'$r$);
  execute def;
  def := pg_get_functiondef('public.thread_record_skeleton(jsonb,jsonb)'::regprocedure);
  def := replace(def, $r$'type', 'WorkingSkeleton', 'title'$r$, $r$'type', 'WorkingSkeleton', 'owner_id', run.owner_id, 'title'$r$);
  execute def;
  def := pg_get_functiondef('public.thread_record_iteration(jsonb,jsonb)'::regprocedure);
  def := replace(def, $r$'type', 'Iteration', 'title'$r$, $r$'type', 'Iteration', 'owner_id', ra.owner_id, 'title'$r$);
  execute def;
end $do$;