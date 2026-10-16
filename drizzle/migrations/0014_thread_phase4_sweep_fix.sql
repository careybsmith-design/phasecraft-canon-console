CREATE OR REPLACE FUNCTION public.thread_fabric_sweep_scoped(p_actor jsonb, p_now timestamp with time zone, p_only uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.objects; uses int; v_cost numeric; win int; pub timestamptz; reason text; retired jsonb := '[]'; flagged jsonb := '[]'; w record;
begin
  perform public._assert_actor(p_actor);
  for o in select * from public.objects where type = 'ComposableCapability' and not is_tombstone and lifecycle_state not in ('proposed','retired')
           and (p_only is null or id = any(p_only)) for update loop
    win := coalesce((o.body->'minimum_use_threshold'->>'window_days')::int, 30);
    pub := coalesce((o.body->>'published_at')::timestamptz, o.created_at);
    select count(*), coalesce(sum(u.cost), 0) into uses, v_cost from public.capability_usage u where u.capability_id = o.id and u.at > p_now - make_interval(days => win) and u.at <= p_now;
    reason := null;
    if o.expires_at is not null and o.expires_at <= p_now then reason := 'expiration condition met';
    elsif p_now - pub >= make_interval(days => win) and uses < coalesce((o.body->'minimum_use_threshold'->>'uses')::int, 0) then
      reason := format('use below minimum (%s < %s in %s days)', uses, o.body->'minimum_use_threshold'->>'uses', win);
    end if;
    if reason is not null then
      o.lifecycle_state := 'retired'; o.retired_at := p_now; o.retirement_reason := 'automatic retirement: ' || reason;
      o.body := o.body || jsonb_build_object('is_machine_discoverable', false);
      o.version := o.version + 1;
      o := public._thread_apply(p_actor, o, 'capability.retired', jsonb_build_object('reason', reason, 'uses_in_window', uses, 'automatic', true));
      retired := retired || jsonb_build_object('id', o.id, 'ref', o.human_ref, 'reason', reason);
      for w in select e.from_id from public.edges e join public.objects x on x.id = e.from_id
               where e.to_id = o.id and e.verb = 'composes' and e.retired_at is null and not x.is_tombstone and x.authority_level > 'observe' loop
        perform public.thread_authority_event(p_actor, w.from_id, 'value_review_underperformance', array[o.id]);
      end loop;
    elsif (o.body->'operating_cost_ceiling'->>'amount') is not null and v_cost > (o.body->'operating_cost_ceiling'->>'amount')::numeric
          and o.lifecycle_state <> 'underperforming' then
      o.lifecycle_state := 'underperforming'; o.version := o.version + 1;
      o := public._thread_apply(p_actor, o, 'capability.cost_ceiling_exceeded', jsonb_build_object('cost_in_window', v_cost));
      if o.authority_level > 'observe' then perform public.thread_authority_event(p_actor, o.id, 'value_review_underperformance', '{}'); end if;
      flagged := flagged || jsonb_build_object('id', o.id, 'ref', o.human_ref, 'reason', 'operating cost ceiling exceeded');
    elsif o.review_date < p_now::date then
      flagged := flagged || jsonb_build_object('id', o.id, 'ref', o.human_ref, 'reason', 'review date passed');
    end if;
  end loop;
  return jsonb_build_object('retired', retired, 'flagged', flagged);
end $function$;
