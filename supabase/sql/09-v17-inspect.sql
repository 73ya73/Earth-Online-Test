-- Read-only: run BEFORE approval/08 to confirm actual cloud structure and permissions.
select column_name,data_type,is_nullable,column_default from information_schema.columns
where table_schema='public' and table_name='research_submissions' order by ordinal_position;
select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.research_submissions'::regclass;
select relrowsecurity,relforcerowsecurity from pg_class where oid='public.research_submissions'::regclass;
select r,has_table_privilege(r,'public.research_submissions','SELECT,INSERT,UPDATE,DELETE') as table_access,
 has_any_column_privilege(r,'public.research_submissions','SELECT,INSERT,UPDATE') as column_access
from (values ('anon'),('authenticated'),('service_role')) roles(r);
select p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'store_research_submission%';
