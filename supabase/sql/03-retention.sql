-- Enable Supabase Cron (pg_cron) in Dashboard first. Schedule as project owner.
-- This is the actual deletion policy, not just a UI statement. Review first.
do $$ begin
 if not exists(select 1 from pg_extension where extname='pg_cron') then
  raise exception 'Enable Supabase Cron first';
 end if;
end $$;
select cron.schedule('earth-online-retention','15 3 * * *',
 'select research_private.purge_expired();');
-- Confirm job enabled and monitor executions in Dashboard > Cron.
select jobid,jobname,schedule,active from cron.job where jobname='earth-online-retention';
-- Expected active=true, schedule='15 3 * * *'. Cron uses its configured timezone.
select coalesce(current_setting('cron.timezone',true),'GMT') as cron_timezone;
-- Run this later to see success/failure; no rows before the first run is normal.
select r.jobid,r.status,r.return_message,r.start_time,r.end_time
from cron.job_run_details r join cron.job j using(jobid)
where j.jobname='earth-online-retention'
order by r.start_time desc limit 5;
