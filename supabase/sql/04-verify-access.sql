-- READ ONLY. One JSON result; no participant rows or secrets.
select jsonb_build_object(
 'columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',udt_name,'nullable',is_nullable,'default',column_default) order by ordinal_position)
  from information_schema.columns where table_schema='public' and table_name='research_submissions'),
 'constraints',(select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid),'validated',convalidated) order by conname)
  from pg_constraint where conrelid='public.research_submissions'::regclass),
 'rls',(select jsonb_build_object('enabled',relrowsecurity,'forced',relforcerowsecurity) from pg_class where oid='public.research_submissions'::regclass),
 'policy_count',(select count(*) from pg_policies where schemaname='public' and tablename='research_submissions'),
 'rpc_exists',to_regprocedure('public.store_research_submission(jsonb)') is not null,
 'rpc_security_definer',(select prosecdef from pg_proc where oid=to_regprocedure('public.store_research_submission(jsonb)')),
 'rpc_settings',(select proconfig from pg_proc where oid=to_regprocedure('public.store_research_submission(jsonb)')),
 'permissions',(select jsonb_agg(jsonb_build_object(
  'role',role_name,
  'select',has_table_privilege(role_name,'public.research_submissions','SELECT'),
  'insert',has_table_privilege(role_name,'public.research_submissions','INSERT'),
  'update',has_table_privilege(role_name,'public.research_submissions','UPDATE'),
  'delete',has_table_privilege(role_name,'public.research_submissions','DELETE'),
  'column_select',has_any_column_privilege(role_name,'public.research_submissions','SELECT'),
  'column_insert',has_any_column_privilege(role_name,'public.research_submissions','INSERT'),
  'column_update',has_any_column_privilege(role_name,'public.research_submissions','UPDATE'),
  'rpc',case when to_regprocedure('public.store_research_submission(jsonb)') is not null then
   has_function_privilege(role_name,to_regprocedure('public.store_research_submission(jsonb)'),'EXECUTE') else false end))
  from (values ('anon'),('authenticated'),('service_role')) r(role_name))
) as verification;
-- Expected result_type=jsonb; all five nullable=NO; submitted_at default now().
-- Existing PK and valid_answers/valid_scores remain; new array CHECK validated.
-- RLS enabled=true, forced=false, policy_count=0. RPC exists/definer=true.
-- All roles' SELECT/INSERT/UPDATE/DELETE=false; only service_role RPC=true.
-- All three column_* flags must also be false for these roles.
