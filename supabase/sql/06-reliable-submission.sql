-- Incremental migration AFTER 02-prepare.sql. Run as postgres, entire file.
-- No table/column/policy changes; no client grants; existing rows and Cron retained.
-- v2 leaves the old Edge contract usable during the staged deployment.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$
begin
 if to_regprocedure('public.store_research_submission(jsonb)') is null
  or to_regclass('research_private.request_windows') is null
  or not exists(select 1 from information_schema.columns where table_schema='public'
   and table_name='research_submissions' and column_name='result_type' and udt_name='jsonb') then
  raise exception 'Expected completed 02-prepare.sql migration';
 end if;
end $$;

create or replace function public.store_research_submission_v2(record jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare used integer; affected integer; existing public.research_submissions%rowtype;
 current_minute timestamptz := date_trunc('minute',clock_timestamp());
begin
 if jsonb_typeof(record) is distinct from 'object' then
  raise exception 'invalid_record' using errcode='22023';
 end if;
 if (select count(*) from jsonb_object_keys(record)) <> 5
  or not (record ?& array['submission_id','submitted_at','answers','result_type','scores'])
  or jsonb_typeof(record->'answers') is distinct from 'object'
  or jsonb_typeof(record->'scores') is distinct from 'object'
  or jsonb_typeof(record->'result_type') is distinct from 'array' then
  raise exception 'invalid_record' using errcode='22023';
 end if;
 insert into research_private.request_windows as windows(minute,requests)
 values(current_minute,1) on conflict(minute) do update set requests=windows.requests+1
 returning requests into used;
 if used>120 then return 'rate_limited'; end if;
 insert into public.research_submissions(submission_id,submitted_at,answers,result_type,scores)
 values((record->>'submission_id')::uuid,clock_timestamp(),record->'answers',record->'result_type',record->'scores')
 on conflict(submission_id) do nothing;
 get diagnostics affected = row_count;
 -- Verify persisted content, including the trigger-suppressed/modified INSERT case.
 -- SELECT after INSERT sees a concurrently committed conflicting row at READ COMMITTED.
 select * into existing from public.research_submissions
 where submission_id=(record->>'submission_id')::uuid for share;
 if not found then raise exception 'persistence_not_confirmed' using errcode='P0001'; end if;
 -- Receipt time is server-owned and naturally differs across retries; don't compare it.
 if existing.answers is distinct from record->'answers'
  or existing.result_type is distinct from record->'result_type'
  or existing.scores is distinct from record->'scores' then
  raise exception 'submission_id_conflict' using errcode='23505';
 end if;
 return case when affected=1 then 'inserted' else 'already_saved' end;
end $$;
revoke all on function public.store_research_submission_v2(jsonb) from public,anon,authenticated;
grant execute on function public.store_research_submission_v2(jsonb) to service_role;

-- Compatibility for the still-live old Edge Function: same text result and ACL.
create or replace function public.store_research_submission(record jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare outcome text;
begin
 outcome := public.store_research_submission_v2(record);
 return case when outcome in ('inserted','already_saved') then 'accepted' else outcome end;
end $$;
revoke all on function public.store_research_submission(jsonb) from public,anon,authenticated;
grant execute on function public.store_research_submission(jsonb) to service_role;

do $$
declare client text;
begin
 foreach client in array array['anon','authenticated'] loop
  if has_table_privilege(client,'public.research_submissions','SELECT,INSERT,UPDATE,DELETE')
   or has_any_column_privilege(client,'public.research_submissions','SELECT,INSERT,UPDATE')
   or has_function_privilege(client,'public.store_research_submission_v2(jsonb)','EXECUTE') then
   raise exception 'Unexpected client privileges: migration rolled back';
  end if;
 end loop;
 if not (select relrowsecurity from pg_class where oid='public.research_submissions'::regclass) then
  raise exception 'RLS must remain enabled';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
