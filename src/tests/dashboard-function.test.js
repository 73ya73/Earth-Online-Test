import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createSubmission} from '../utils/research.js';
const root=new URL('../../',import.meta.url),source=fs.readFileSync(new URL('supabase/dashboard/submit-research.ts',root),'utf8');
const questions=JSON.parse(fs.readFileSync(new URL('src/data/questions.json',root)));
test('Dashboard single file contains the exact current server sources without unresolved imports',()=>{
 const hash=createHash('sha256');
 for(const path of ['submit-research/index.ts','_shared/handler.js','_shared/research.js','_shared/questions.js','_shared/scoring/answers.js','_shared/scoring/engine.js'])hash.update(path+'\n').update(fs.readFileSync(new URL('supabase/functions/'+path,root),'utf8').replace(/\r\n/g,'\n'));
 assert.ok(source.includes('// Source SHA-256: '+hash.digest('hex')));assert.doesNotMatch(source,/^import\s/m);
});
test('Dashboard bundle handles preflight, recomputes a real complete answer and invokes only server RPC',async()=>{
 let handler;const calls=[];let rpcResult='inserted',rpcStatus=200,transportError=null;
 const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'not-a-real-service-key',RESEARCH_ALLOWED_ORIGINS:'https://73ya73.github.io,http://127.0.0.1:5173'};
 const context=vm.createContext({Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn;}},Request,Response,TextDecoder,Uint8Array,AbortSignal,setTimeout,clearTimeout,console,
  fetch:async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});if(transportError)throw transportError;return new Response(JSON.stringify(rpcResult),{status:rpcStatus,headers:{'Content-Type':'application/json'}});}});
 vm.runInContext(source,context);assert.equal(typeof handler,'function');
 const origin='http://127.0.0.1:5173',url='https://example.supabase.co/functions/v1/submit-research';
 const pre=await handler(new Request(url,{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(pre.status,204);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(calls.length,0);
 const answers=Object.fromEntries(questions.map(q=>[q.questionId,['A']])),payload=createSubmission(questions,answers);
 const invoke=p=>handler(new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(p)}));
 assert.equal((await invoke({...payload,scores:{...payload.scores,ACT:999}})).status,400);assert.equal(calls.length,0);
 const good=await invoke(payload);assert.equal(good.status,200);assert.deepEqual(await good.json(),{ok:true,submission_id:payload.submission_id,status:'inserted'});assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://example.supabase.co/rest/v1/rpc/store_research_submission_v2');assert.deepEqual(calls[0].body.record.scores,payload.scores);assert.deepEqual(calls[0].body.record.result_type,payload.result_type);assert.equal(Object.keys(calls[0].body.record).length,5);
 for(const [code,http,expected,category] of [['42501',403,403,'permission'],['23514',400,422,'database_rejected'],['23505',409,409,'id_conflict'],['XX000',500,503,'database']]){
  rpcResult={code,message:'private database details'};rpcStatus=http;const failed=await invoke(payload);assert.equal(failed.status,expected);assert.equal((await failed.json()).error,category);
 }
 rpcStatus=200;rpcResult='accepted';assert.equal((await invoke(payload)).status,503);
 for(const name of ['TimeoutError','TypeError']){transportError=Object.assign(Error('private transport details'),{name});const failed=await invoke(payload);assert.equal(failed.status,503);assert.equal((await failed.json()).error,name==='TimeoutError'?'timeout':'network');}

});
