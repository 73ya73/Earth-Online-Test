-- UPDATED 2026-10-18 for the user-reported existing schema.
-- Run this COMPLETE file in Supabase SQL Editor as postgres.
-- result_type: text -> jsonb array, e.g. ACT -> ["ACT"]. Existing rows retained.
-- Keeps the existing primary key, NOT NULLs, submitted_at default,
-- valid_answers/valid_scores checks and RLS. No anonymous grants or test_version.
-- Unknown data, defaults, cross-column checks or dependencies abort the transaction.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.research_submissions in access exclusive mode;
do $$
declare expected record; id_attribute smallint;
begin
 if to_regclass('public.research_submissions') is null then
  raise exception 'Existing research_submissions table not found; run 01-inspect first';
 end if;
 for expected in select * from (values ('submission_id','uuid'),('submitted_at','timestamptz'),('answers','jsonb'),('scores','jsonb')) as x(col,typ)
 loop
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='research_submissions' and column_name=expected.col and udt_name=expected.typ and is_nullable='NO') then
   raise exception 'Schema mismatch for %. Expected %. No conversion performed.',expected.col,expected.typ;
  end if;
 end loop;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='research_submissions' and column_name='result_type' and udt_name in ('text','jsonb') and is_nullable='NO') then
  raise exception 'Expected NOT NULL result_type text or jsonb';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='research_submissions' and column_name='result_type' and column_default is not null) then
  raise exception 'Unexpected result_type default: review it before migration';
 end if;
 select attnum into id_attribute from pg_attribute where attrelid='public.research_submissions'::regclass and attname='submission_id';
 if not exists(select 1 from pg_constraint where conrelid='public.research_submissions'::regclass and contype='p' and conkey=array[id_attribute]) then
  raise exception 'Expected existing single-column submission_id primary key';
 end if;
end $$;

-- Temporary in-transaction copy verifies that no prior row/other field changes.
create temporary table earth_research_before on commit drop as
select submission_id,submitted_at,answers,scores,
 case when pg_typeof(result_type)::text='text' then jsonb_build_array(result_type)
 else to_jsonb(result_type) end as expected_result_type
from public.research_submissions;

do $$
declare old_type text; result_attribute smallint; check_definition record;
begin
 select udt_name into old_type from information_schema.columns
 where table_schema='public' and table_name='research_submissions' and column_name='result_type';
 select attnum into result_attribute from pg_attribute
 where attrelid='public.research_submissions'::regclass and attname='result_type';
 if old_type='text' then
  if exists(select 1 from public.research_submissions where result_type::text not in ('ACT','RESET','SOCIAL','LUCKY','THINK','SAVE','EXPLORING')) then
   raise exception 'Unrecognized existing result_type. No values were guessed or discarded.';
  end if;
  if exists(select 1 from pg_constraint where conrelid='public.research_submissions'::regclass and contype='c' and result_attribute=any(conkey) and cardinality(conkey)<>1) then
   raise exception 'Cross-column result_type CHECK requires manual review';
  end if;
  -- Only CHECKs referencing result_type alone are replaced. Other checks stay.
  for check_definition in select conname from pg_constraint
   where conrelid='public.research_submissions'::regclass and contype='c' and conkey=array[result_attribute]
  loop
   execute format('alter table public.research_submissions drop constraint %I',check_definition.conname);
  end loop;
  execute 'alter table public.research_submissions alter column result_type type jsonb using jsonb_build_array(result_type)';
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.research_submissions'::regclass and conname='research_result_type_array_check') then
  alter table public.research_submissions add constraint research_result_type_array_check check (
   case when jsonb_typeof(result_type)='array' then
    jsonb_array_length(result_type) between 1 and 6
    and result_type <@ '["ACT","RESET","SOCIAL","LUCKY","THINK","SAVE","EXPLORING"]'::jsonb
    and (not (result_type ? 'EXPLORING') or result_type='["EXPLORING"]'::jsonb)
   else false end
  );
 end if;
end $$;
create index if not exists research_submitted_at_idx on public.research_submissions(submitted_at);
alter table public.research_submissions enable row level security;
revoke all on table public.research_submissions from public,anon,authenticated,service_role;
-- Explicit column restriction; effective/inherited privileges are audited below.
revoke all (submission_id,submitted_at,answers,result_type,scores)
 on table public.research_submissions from public,anon,authenticated,service_role;
-- Existing policies need not be destroyed: no public table grants remain.

create schema if not exists research_private;
revoke all on schema research_private from public,anon,authenticated,service_role;
create table if not exists research_private.request_windows (
 minute timestamptz primary key,
 requests integer not null
);
alter table research_private.request_windows enable row level security;
revoke all on table research_private.request_windows from public,anon,authenticated,service_role;

-- Owner executes the transaction; only the Edge server may call this RPC.
create or replace function public.store_research_submission(record jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare used integer; current_minute timestamptz := date_trunc('minute',clock_timestamp());
begin
 if jsonb_typeof(record) is distinct from 'object'
  or (select count(*) from jsonb_object_keys(record)) <> 5
  or not (record ?& array['submission_id','submitted_at','answers','result_type','scores'])
  or jsonb_typeof(record->'answers') is distinct from 'object'
  or jsonb_typeof(record->'scores') is distinct from 'object'
  or jsonb_typeof(record->'result_type') is distinct from 'array' then
  raise exception 'invalid_record' using errcode='22023';
 end if;
 -- Global 120 valid intake requests/minute, atomic across Edge isolates.
 insert into research_private.request_windows as windows(minute,requests)
 values(current_minute,1)
 on conflict(minute) do update set requests=windows.requests+1
 returning requests into used;
 if used>120 then return 'rate_limited'; end if;
 -- Database time, unique UUID, immutable first write; duplicates get generic ACK.
 insert into public.research_submissions(submission_id,submitted_at,answers,result_type,scores)
 values((record->>'submission_id')::uuid,clock_timestamp(),record->'answers',record->'result_type',record->'scores')
 on conflict(submission_id) do nothing;
 return 'accepted';
end $$;
revoke all on function public.store_research_submission(jsonb) from public,anon,authenticated;
grant execute on function public.store_research_submission(jsonb) to service_role;

create or replace function research_private.purge_expired()
returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.research_submissions where submitted_at < now()-interval '180 days';
 delete from research_private.request_windows where minute < now()-interval '1 day';
end $$;
revoke all on function research_private.purge_expired() from public,anon,authenticated,service_role;

do $$
declare client_role text;
begin
 if exists (
  select 1 from earth_research_before b full join public.research_submissions s using(submission_id)
  where b.submission_id is null or s.submission_id is null
   or b.submitted_at is distinct from s.submitted_at or b.answers is distinct from s.answers
   or b.scores is distinct from s.scores or b.expected_result_type is distinct from s.result_type
 ) then raise exception 'Row preservation check failed. Migration rolled back.'; end if;
 foreach client_role in array array['anon','authenticated'] loop
  if has_table_privilege(client_role,'public.research_submissions','SELECT,INSERT,UPDATE,DELETE')
   or has_any_column_privilege(client_role,'public.research_submissions','SELECT,INSERT,UPDATE') then
   raise exception 'Unexpected inherited or column privileges for %. Migration rolled back.',client_role;
  end if;
 end loop;
end $$;
commit;
-- Success may display "Success. No rows returned". Then run 04-verify-access.sql.
