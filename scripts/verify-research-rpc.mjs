// Optional local-only runtime: npm install --no-save --package-lock=false @electric-sql/pglite
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const root=new URL('../',import.meta.url);
const sql=p=>fs.readFileSync(new URL('supabase/sql/'+p,root),'utf8');
const db=new PGlite();
try {
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table public.research_submissions(submission_id uuid primary key,submitted_at timestamptz not null default now(),answers jsonb not null check(jsonb_typeof(answers)='object'),result_type text not null check(result_type in ('ACT','RESET','SOCIAL','LUCKY','THINK','SAVE','EXPLORING')),scores jsonb not null check(jsonb_typeof(scores)='object'));alter table public.research_submissions enable row level security;`);
await db.exec(sql('02-prepare.sql'));
await db.exec(sql('06-reliable-submission.sql'));
const p={submission_id:randomUUID(),submitted_at:new Date().toISOString(),answers:{Q1:['A']},result_type:['ACT'],scores:{ACT:3}};
const call=async(p,name='store_research_submission_v2')=>(await db.query('select public.'+name+'($1::jsonb) as status',[JSON.stringify(p)])).rows[0].status;
await db.exec('set role service_role');assert.equal(await call(p),'inserted');assert.equal(await call(p),'already_saved');assert.equal(await call(p,'store_research_submission'),'accepted');
await assert.rejects(call({...p,scores:{ACT:4}}),e=>e.code==='23505');await assert.rejects(db.query('select * from public.research_submissions'),/permission denied/);await db.exec('reset role');
assert.equal((await db.query('select count(*)::int n from public.research_submissions')).rows[0].n,1);
const before=(await db.query('select * from public.research_submissions')).rows;
await db.exec(sql('06-reliable-submission.sql'));assert.deepEqual((await db.query('select * from public.research_submissions')).rows,before);
for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(call(p),/permission denied/);await assert.rejects(db.query('select * from public.research_submissions'),/permission denied/);await db.exec('reset role');}
const audit=(await db.query(sql('04-verify-access.sql'))).rows[0].verification;assert.equal(audit.rls.enabled,true);assert.equal(audit.policy_count,0);for(const r of audit.permissions){assert.equal(r.insert,false);assert.equal(r.select,false);assert.equal(r.rpc,r.role==='service_role');}
const verification=await db.exec(sql('07-verify-reliable-submission.sql'));assert.equal(verification[0].rows.length,2);for(const row of verification[0].rows){assert.equal(row.anon_execute,false);assert.equal(row.authenticated_execute,false);assert.equal(row.service_role_execute,true);}assert.equal(verification[3].rows[0].v2_contract,true);
console.log('PASS: inserted/already_saved, conflicting payload rejects, old contract compatible, no duplicate row, repeat migration preserves records, RLS and least privilege unchanged.');
await assert.rejects(call({...p,submission_id:randomUUID(),result_type:['INVALID']}));assert.equal((await db.query('select count(*)::int n from public.research_submissions')).rows[0].n,1);
await db.exec(`create function public.suppress_research_insert() returns trigger language plpgsql as $$begin return null;end$$; create trigger suppress before insert on public.research_submissions for each row execute function public.suppress_research_insert();`);
await assert.rejects(call({...p,submission_id:randomUUID()}),e=>e.code==='P0001');await db.exec('drop trigger suppress on public.research_submissions');
await db.exec(`update research_private.request_windows set requests=120 where minute=date_trunc('minute',clock_timestamp())`);assert.equal(await call({...p,submission_id:randomUUID()}),'rate_limited');assert.equal((await db.query('select count(*)::int n from public.research_submissions')).rows[0].n,1);
console.log('PASS: constraint rejection and trigger-suppressed INSERT never falsely acknowledged; global quota preserved.');
}finally{await db.close();}
