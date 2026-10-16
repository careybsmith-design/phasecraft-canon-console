-- RLS and table privileges are separate layers: authenticated writes only exist where an explicit own-row policy allows them.
DO $grants$
DECLARE t record;
BEGIN
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='e') LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon',t.relname);
  IF t.relname<>'surface_follows' THEN EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE public.%I FROM authenticated',t.relname); END IF;
 END LOOP;
END $grants$;
REVOKE ALL ON FUNCTION public.graph_node_json(public.objects),public.graph_edge_json(public.edges) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.graph_node_json(public.objects),public.graph_edge_json(public.edges) TO authenticated,service_role;
ALTER POLICY "read eval items" ON public.extraction_eval_items USING (public.has_role(auth.uid(),'steward') OR public.has_role(auth.uid(),'compliance'));
DO $test$
DECLARE bad integer;
BEGIN
 SELECT count(*) INTO bad FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='e') AND has_table_privilege('anon',c.oid,'select');
 IF bad<>0 THEN RAISE EXCEPTION 'ANONYMOUS_TABLE_GRANTS_REMAIN: %',bad; END IF;
 IF has_table_privilege('authenticated','public.objects','insert') OR has_table_privilege('authenticated','public.ledger','update') OR has_table_privilege('authenticated','public.object_versions','delete') THEN RAISE EXCEPTION 'CANON_DIRECT_WRITE_GRANTS_REMAIN'; END IF;
 IF NOT has_table_privilege('authenticated','public.surface_follows','insert') THEN RAISE EXCEPTION 'OWN_FOLLOW_WRITE_REMOVED'; END IF;
END $test$;