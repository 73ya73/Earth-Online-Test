-- Read-only. Run after 06; no participant answers are selected.
select p.proname as function_name,pg_get_function_result(p.oid) as returns,
 p.prosecdef as security_definer,p.proconfig as settings,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute,
 pg_get_userbyid(p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('store_research_submission','store_research_submission_v2')
 and pg_get_function_identity_arguments(p.oid)='record jsonb'
order by p.proname;

select relrowsecurity as rls_enabled,relforcerowsecurity as rls_forced
from pg_class where oid='public.research_submissions'::regclass;

select role,
 has_table_privilege(role,'public.research_submissions','SELECT,INSERT,UPDATE,DELETE') as any_table_access,
 has_any_column_privilege(role,'public.research_submissions','SELECT,INSERT,UPDATE') as any_column_access
from (values ('anon'),('authenticated'),('service_role')) as roles(role);

select
 position('already_saved' in pg_get_functiondef('public.store_research_submission_v2(jsonb)'::regprocedure))>0 as v2_contract,
 position('store_research_submission_v2' in pg_get_functiondef('public.store_research_submission(jsonb)'::regprocedure))>0 as compatibility_wrapper;
