-- PREPARED ONLY. Requires user approval and verified 06 schema; do not run 02 again.
-- Adds nullable metadata. Never reclassifies/backfills/deletes historical submissions.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$begin
 if to_regprocedure('public.store_research_submission_v2(jsonb)') is null
  or not exists(select 1 from pg_constraint where conrelid='public.research_submissions'::regclass and conname='research_result_type_array_check') then
  raise exception 'Verify the existing 06 schema before migration';
 end if;
end $$;
alter table public.research_submissions add column if not exists candidate_types jsonb;
alter table public.research_submissions add column if not exists algorithm_version text;
alter table public.research_submissions add column if not exists locale text;
alter table public.research_submissions drop constraint research_result_type_array_check;
alter table public.research_submissions add constraint research_result_type_array_check check (
 case when jsonb_typeof(result_type)='array' then
 jsonb_array_length(result_type) between 1 and 6
 and result_type <@ '["ACT","RESET","SOCIAL","LUCKY","THINK","SAVE","EXPLORING","MULTI"]'::jsonb
 and (not(result_type ? 'EXPLORING') or result_type='["EXPLORING"]'::jsonb)
 and (not(result_type ? 'MULTI') or result_type='["MULTI"]'::jsonb)
 else false end);
alter table public.research_submissions drop constraint if exists research_v17_metadata_check;
alter table public.research_submissions add constraint research_v17_metadata_check check (
 case when algorithm_version is null then candidate_types is null and locale is null and not(result_type ? 'MULTI')
 else coalesce(algorithm_version='pilot-1.7-raw-v1' and locale in ('zh','en')
 and jsonb_typeof(candidate_types)='array' and jsonb_array_length(candidate_types)<=6
 and candidate_types <@ '["ACT","RESET","SOCIAL","LUCKY","THINK","SAVE"]'::jsonb
 and jsonb_array_length(result_type)=1
 and case when result_type='["MULTI"]'::jsonb then jsonb_array_length(candidate_types)>=2
 when result_type='["EXPLORING"]'::jsonb then candidate_types='[]'::jsonb
 else candidate_types=result_type end,false) end);
revoke all (candidate_types,algorithm_version,locale) on table public.research_submissions from public,anon,authenticated,service_role;

create or replace function public.store_research_submission_v17(record jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare used integer; affected integer; existing public.research_submissions%rowtype;
begin
 if jsonb_typeof(record) is distinct from 'object' then raise exception 'invalid_record' using errcode='22023'; end if;
 if (select count(*) from jsonb_object_keys(record))<>8
 or not(record ?& array['submission_id','submitted_at','answers','result_type','scores','candidate_types','algorithm_version','locale'])
 or record->>'algorithm_version' is distinct from 'pilot-1.7-raw-v1'
 or coalesce(record->>'locale','') not in ('zh','en') then raise exception 'invalid_record' using errcode='22023'; end if;
 insert into research_private.request_windows as w(minute,requests)
 values(date_trunc('minute',clock_timestamp()),1)
 on conflict(minute) do update set requests=w.requests+1 returning requests into used;
 if used>120 then return 'rate_limited'; end if;
 insert into public.research_submissions(submission_id,submitted_at,answers,result_type,scores,candidate_types,algorithm_version,locale)
 values((record->>'submission_id')::uuid,clock_timestamp(),record->'answers',record->'result_type',record->'scores',record->'candidate_types',record->>'algorithm_version',record->>'locale')
 on conflict(submission_id) do nothing;
 get diagnostics affected=row_count;
 select * into existing from public.research_submissions where submission_id=(record->>'submission_id')::uuid for share;
 if not found then raise exception 'persistence_not_confirmed' using errcode='P0001'; end if;
 if existing.answers is distinct from record->'answers' or existing.result_type is distinct from record->'result_type'
 or existing.scores is distinct from record->'scores' or existing.candidate_types is distinct from record->'candidate_types'
 or existing.algorithm_version is distinct from record->>'algorithm_version' or existing.locale is distinct from record->>'locale'
 then raise exception 'submission_id_conflict' using errcode='23505'; end if;
 return case when affected=1 then 'inserted' else 'already_saved' end;
end $$;
revoke all on function public.store_research_submission_v17(jsonb) from public,anon,authenticated;
grant execute on function public.store_research_submission_v17(jsonb) to service_role;
do $$declare r text;begin
 foreach r in array array['anon','authenticated'] loop
  if has_table_privilege(r,'public.research_submissions','SELECT,INSERT,UPDATE,DELETE')
   or has_any_column_privilege(r,'public.research_submissions','SELECT,INSERT,UPDATE')
   or has_function_privilege(r,'public.store_research_submission_v17(jsonb)','EXECUTE') then raise exception 'Unexpected public privileges'; end if;
 end loop;
 if not(select relrowsecurity from pg_class where oid='public.research_submissions'::regclass) then raise exception 'RLS must remain enabled'; end if;
end $$;
notify pgrst,'reload schema';
commit;
