create extension if not exists pg_cron;
select cron.schedule('thread-rendition-sweep', '0 * * * *', $$select public.thread_rendition_sweep()$$);
select cron.schedule('thread-morning-briefs', '0 5 * * *', $$select public.thread_generate_morning_briefs()$$);