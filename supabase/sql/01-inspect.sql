-- READ ONLY. Run in SQL Editor and return these results; no participant rows.
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='research_submissions'
order by ordinal_position;
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid=to_regclass('public.research_submissions');
select indexname,indexdef from pg_indexes
where schemaname='public' and tablename='research_submissions';
select relrowsecurity,relforcerowsecurity from pg_class
where oid=to_regclass('public.research_submissions');
select policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename='research_submissions';
select grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='research_submissions';
