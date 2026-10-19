-- N03: register the steward-approved image-reading route (approved 2026-10-19 by the steward in chat).
-- Evidence: golden-set evaluation 10/10 accuracy, Tier C recall 1.0 (scripts/eval-image-reading.ts,
-- docs/audit/image-reading-eval-2026-10-19.json); gateway reports data_retention zero on responses.
DO $$
DECLARE
  actor jsonb := jsonb_build_object('kind','system','id','thread.governance','authority_used','observe');
  steward uuid := (SELECT user_id FROM public.user_roles WHERE role='steward' ORDER BY user_id LIMIT 1);
BEGIN
  IF EXISTS (SELECT 1 FROM public.model_routes WHERE route_key='intent.vlm.v1') THEN RETURN; END IF;
  PERFORM public.thread_create_object(actor, jsonb_build_object(
    'type','ModelRoute','title','Image reading route (intent.vlm.v1)',
    'statement','Steward-approved image reading for session captures: read all visible text so the deterministic gate can classify it before storage.',
    'machine_description','ModelRoute clearance for intent.vlm.v1',
    'owner_id',steward,
    'review_date',(current_date + 90)::text,
    'expiration_condition',jsonb_build_object('kind','review_date_passes'),
    'retirement_path',jsonb_build_object('mode','tombstone'),
    'risk_tier','2',
    'permission',jsonb_build_object('roles','[]'::jsonb,'purpose','model route governance'),
    'data_classification','internal',
    'rationale','Steward approved the screen capture and image reading service on 2026-10-19; golden-set evaluation passed.',
    'body',jsonb_build_object(
      'route_key','intent.vlm.v1',
      'provider','Lovable AI Gateway (openai)',
      'endpoint','https://ai.gateway.lovable.dev/v1/responses',
      'region','gateway default',
      'cleared_content_tiers',jsonb_build_array('A'),
      'attestation_ref','steward-approval-2026-10-19; gateway data_retention_by_surface.responses=zero',
      'attestation_expiry',(now() + interval '90 days')::text,
      'model_version_pin','openai/gpt-6-astra',
      'cost_profile','per-token',
      'eval_status','passed',
      'eval_evidence',jsonb_build_object('suite','image-reading-golden-v1','n',10,'accuracy',1.0,'tier_c_recall',1.0,'run_at','2026-10-19'),
      'permitted_task_classes',jsonb_build_array('whiteboard structured description (8A.2)'),
      'invocation_logging_off',true,
      'provenance',jsonb_build_object('simulated',false,'source','steward approval + live evaluation'))));
END $$;