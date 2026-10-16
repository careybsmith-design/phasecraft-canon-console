-- User-confirmed correction (16 Oct 2026): Lovable is cleared up to confidential, like the other four platforms.
-- The registry guard is lifted for this single correction and re-applied immediately.
alter table public.build_platforms disable trigger build_platforms_append_only;
update public.build_platforms set cleared_classes = '{public,internal,confidential}' where platform = 'lovable';
alter table public.build_platforms enable trigger build_platforms_append_only;