// Local in-memory PostgreSQL only. Optional PGLITE_MODULE may point to an installed runtime.
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createSubmission} from '../src/utils/research.js';
import {createV17Submission} from '../src/utils/research-v17.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const sql=name=>read('supabase/sql/'+name),questions=JSON.parse(read('src/data/questions.json')),fixtures=JSON.parse(read('reports/v1.7-fixtures.json'));
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table public.research_submissions(submission_id uuid primary key,submitted_at timestamptz not null default now(),answers jsonb not null check(jsonb_typeof(answers)='object'),result_type text not null check(result_type in ('ACT','RESET','SOCIAL','LUCKY','THINK','SAVE','EXPLORING')),scores jsonb not null check(jsonb_typeof(scores)='object'));alter table public.research_submissions enable row level security;`);
 await db.exec(sql('02-prepare.sql'));await db.exec(sql('06-reliable-submission.sql'));
 const call=async(record,fn='store_research_submission_v17')=>(await db.query(`select public.${fn}($1::jsonb) as status`,[JSON.stringify(record)])).rows[0].status;
 const legacy=createSubmission(questions,fixtures.ACT);assert.equal(await call(legacy,'store_research_submission_v2'),'inserted');
 const before=(await db.query('select * from public.research_submissions')).rows;
 await db.exec(sql('08-v17-compatibility.sql'));
 const historical=(await db.query('select * from public.research_submissions')).rows[0];
 for(const k of ['submission_id','submitted_at','answers','result_type','scores'])assert.deepEqual(historical[k],before[0][k]);
 for(const k of ['candidate_types','algorithm_version','locale'])assert.equal(historical[k],null);
 const p=createV17Submission(questions,fixtures.MULTI,'en');
 await db.exec('set role service_role');assert.equal(await call(p),'inserted');assert.equal(await call(p),'already_saved');
 await assert.rejects(call({...p,locale:'zh'}),e=>e.code==='23505');await assert.rejects(call({...p,scores:{...p.scores,ACT:p.scores.ACT+1}}),e=>e.code==='23505');
 await assert.rejects(db.query('select * from public.research_submissions'),/permission denied/);await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from public.research_submissions')).rows[0].n,2);
 const wrong=createV17Submission(questions,fixtures.MULTI);wrong.candidate_types=[];await assert.rejects(call(wrong),e=>e.code==='23514');
 for(const r of ['anon','authenticated']){await db.exec('set role '+r);await assert.rejects(call(p),/permission denied/);await assert.rejects(db.query('select * from public.research_submissions'),/permission denied/);await db.exec('reset role');}
 const snapshot=(await db.query('select * from public.research_submissions order by submission_id')).rows;
 await db.exec(sql('08-v17-compatibility.sql'));assert.deepEqual((await db.query('select * from public.research_submissions order by submission_id')).rows,snapshot);
 const report=(await db.query(sql('04-verify-access.sql'))).rows[0].verification;assert.equal(report.rls.enabled,true);for(const r of report.permissions){assert.equal(r.select,false);assert.equal(r.insert,false);assert.equal(r.column_insert,false);}
 const legacy2=createSubmission(questions,fixtures.SOCIAL);assert.equal(await call(legacy2,'store_research_submission_v2'),'inserted');
 console.log('PASS: 08 migration preserves legacy records and NULL metadata; V17 insert/dedup/content conflict; metadata checks; least privilege/RLS; idempotent migration; old RPC remains compatible. No cloud connection.');
}finally{await db.close();}
