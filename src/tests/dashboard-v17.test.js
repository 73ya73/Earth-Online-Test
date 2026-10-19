import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createV17Submission} from '../utils/research-v17.js';
const root=new URL('../../',import.meta.url),source=fs.readFileSync(new URL('supabase/dashboard/submit-research-v17.ts',root),'utf8');
const questions=JSON.parse(fs.readFileSync(new URL('src/data/questions.json',root))),fixtures=JSON.parse(fs.readFileSync(new URL('reports/v1.7-fixtures.json',root)));
test('V17 Dashboard file contains exact current versioned validator/config and no unresolved imports',()=>{
 const hash=createHash('sha256');
 for(const path of ['submit-research-v17/index.ts','_shared/handler.js','_shared/research.js','_shared/research-v17.js','_shared/questions.js','_shared/scoring/answers.js','_shared/scoring/engine.js','_shared/scoring/v17.js','_shared/scoring/v17-config.js'])hash.update(path+'\n').update(fs.readFileSync(new URL('supabase/functions/'+path,root),'utf8').replace(/\r\n/g,'\n'));
 assert.ok(source.includes('// Source SHA-256: '+hash.digest('hex')));assert.doesNotMatch(source,/^import\s/m);
});
test('V17 deployed-shaped bundle recomputes MULTI and sends eight canonical fields only to V17 RPC',async()=>{
 let handler;const calls=[],origin='http://127.0.0.1:5188';let outcome='inserted';
 const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'not-a-real-service-key',RESEARCH_ALLOWED_ORIGINS:origin};
 const context=vm.createContext({Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn;}},Request,Response,TextDecoder,Uint8Array,AbortSignal,setTimeout,clearTimeout,console:{info(){},error(){},warn(){}},fetch:async(url,options)=>{calls.push({url,record:JSON.parse(options.body).record});return new Response(JSON.stringify(outcome));}});
 vm.runInContext(source,context);
 const payload=createV17Submission(questions,fixtures.MULTI,'en');
 const invoke=record=>handler(new Request('https://example.supabase.co/functions/v1/submit-research-v17',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(record)}));
 const result=await invoke(payload);assert.equal(result.status,200);assert.deepEqual(await result.json(),{ok:true,submission_id:payload.submission_id,status:'inserted'});
 assert.equal(calls[0].url,'https://example.supabase.co/rest/v1/rpc/store_research_submission_v17');assert.deepEqual(calls[0].record.result_type,['MULTI']);assert.equal(calls[0].record.locale,'en');assert.equal(Object.keys(calls[0].record).length,8);
 for(const changed of [{...payload,scores:{...payload.scores,ACT:999}},{...payload,candidate_types:[]},{...payload,result_type:['ACT']},{...payload,algorithm_version:'unknown'}])assert.equal((await invoke(changed)).status,400);
 assert.equal(calls.length,1);outcome='already_saved';assert.equal((await (await invoke(payload)).json()).status,'already_saved');outcome='accepted';assert.equal((await invoke(payload)).status,503);
});
