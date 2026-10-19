import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID,webcrypto} from 'node:crypto';
import {createResearchQueue,OUTBOX_PREFIX,RECOVERY_COOLDOWN_MS} from '../utils/researchQueue.js';
import {createSubmission} from '../utils/research.js';
import {createHandler} from '../../supabase/functions/_shared/handler.js';
const questions=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url)));
const payload=()=>createSubmission(questions,Object.fromEntries(questions.map(q=>[q.questionId,['A']])));
function storage(){const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
const response=(p,status='inserted')=>new Response(JSON.stringify({ok:true,submission_id:p.submission_id,status}),{status:200});
function fixture(options={}){let time=100;const store=storage(),logs=[];const config={endpoint:'https://test.invalid/submit',storage:store,now:()=>time,random:()=>0,logger:{debug:(...x)=>logs.push(x),warn:(...x)=>logs.push(x)},debug:true,...options};return {store,logs,config,queue:createResearchQueue(config),advance:ms=>time+=ms};}

test('durable enqueue precedes fetch; only matching explicit persistence ACK removes payload',async()=>{
 const p=payload();let calls=0;const f=fixture({fetcher:async(_u,o)=>{calls++;assert.ok(f.store.getItem(OUTBOX_PREFIX+p.submission_id));assert.equal(JSON.parse(o.body).submission_id,p.submission_id);return response(p);}});
 f.queue.enqueue(p);assert.equal(calls,0);await Promise.all([f.queue.flush(),f.queue.flush()]);assert.equal(calls,1);assert.equal(f.queue.inspect().length,0);
 const restored=createResearchQueue(f.config);assert.equal(restored.enqueue(p).status,'saved');await restored.flush();assert.equal(calls,1);
 const saved=f.logs.map(x=>x[1]).find(x=>x?.status==='saved');assert.equal(saved.submission_id,p.submission_id);assert.equal(saved.http_status,200);assert.equal(saved.attempts,1);assert.equal(typeof saved.duration_ms,'number');assert.equal(JSON.stringify(f.logs).includes('answers'),false);
});

test('offline does not consume attempts; new page recovers independent outbox without progress',async()=>{
 const p=payload();let connected=false,calls=0;const f=fixture({online:()=>connected,fetcher:async()=>{calls++;return response(p);}});
 f.queue.enqueue(p);await f.queue.flush();assert.equal(calls,0);assert.equal(f.queue.inspect()[0].attempts,0);
 const newPage=createResearchQueue(f.config);connected=true;await newPage.flush();assert.equal(calls,1);assert.equal(newPage.inspect().length,0);
});

test('network retry backs off, survives visits, caps at three and retains failed payload',async()=>{
 const p=payload();let calls=0;const f=fixture({fetcher:async()=>{calls++;throw Error('network down');}});f.queue.enqueue(p);
 await f.queue.flush();assert.equal(calls,1);assert.equal(f.queue.inspect()[0].status,'pending');await f.queue.flush();assert.equal(calls,1);
 f.advance(1000);const visit=createResearchQueue(f.config);await visit.flush();assert.equal(calls,2);assert.equal(visit.inspect()[0].nextAttemptAt,3100);
 f.advance(2000);await visit.flush();assert.equal(calls,3);assert.equal(visit.inspect()[0].status,'failed');
 for(let i=0;i<3;i++){f.advance(60000);const another=createResearchQueue(f.config);another.recover(p);await another.flush();}assert.equal(calls,3);assert.ok(f.store.getItem(OUTBOX_PREFIX+p.submission_id));
});

test('timeout after server commit retries same ID and accepts already_saved',async()=>{
 const p=payload(),rows=new Set(),ids=[];let first=true;const f=fixture({timeoutMs:5,fetcher:(_u,o)=>{const id=JSON.parse(o.body).submission_id;ids.push(id);rows.add(id);if(first){first=false;return new Promise((_r,reject)=>o.signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))));}return Promise.resolve(response(p,'already_saved'));}});
 f.queue.enqueue(p);await f.queue.flush();assert.equal(f.queue.inspect()[0].error,'timeout');f.advance(1000);await f.queue.flush();assert.equal(rows.size,1);assert.deepEqual(ids,[p.submission_id,p.submission_id]);assert.equal(f.queue.inspect().length,0);
});

test('closing during in-flight request preserves consumed attempt and recovers after lease',async()=>{
 const p=payload();const f=fixture();f.queue.enqueue(p);const e=f.queue.inspect()[0];f.store.setItem(OUTBOX_PREFIX+p.submission_id,JSON.stringify({...e,attempts:1,inflightUntil:17100}));let calls=0;
 const newPage=createResearchQueue({...f.config,fetcher:async()=>{calls++;return response(p,'already_saved');}});await newPage.flush();assert.equal(calls,0);f.advance(17001);await newPage.flush();assert.equal(calls,1);assert.equal(newPage.inspect().length,0);
});

test('HTTP 200 or ok alone, wrong ID and unconfirmed status never mark saved',async()=>{
 for(const ack of [{ok:true},{ok:true,status:'inserted',submission_id:randomUUID()},{ok:true,status:'accepted'},{ok:true,status:'pending'}]){
  const p=payload(),f=fixture({fetcher:async()=>new Response(JSON.stringify(ack))});f.queue.enqueue(p);await f.queue.flush();assert.equal(f.queue.inspect()[0].error,'invalid_ack');assert.equal(f.queue.inspect()[0].status,'failed');assert.equal(f.store.getItem('earth-recharge-submitted-v1:'+p.submission_id),null);
 }
});

test('deterministic 400/401/403/409/422 fail once; 408/429/temporary 5xx retry with Retry-After',async()=>{
 for(const status of [400,401,403,409,422,408,429,500,502,503,504]){
  const f=fixture({fetcher:async()=>new Response('{}',{status,headers:{'Retry-After':'60'}})});f.queue.enqueue(payload());await f.queue.flush();const e=f.queue.inspect()[0];assert.equal(e.httpStatus,status);assert.equal(e.status,[400,401,403,409,422].includes(status)?'failed':'pending');if(e.status==='pending')assert.equal(e.nextAttemptAt,60100);
 }
});

test('old attempted complete payload resumes same ID, old sent skips, no arbitrary history backfill',async()=>{
 const p=payload(),sent=payload();let calls=0;const f=fixture({fetcher:async(_u,o)=>{calls++;return response(JSON.parse(o.body),'already_saved');}});
 f.store.setItem('earth-recharge-submitted-v1:'+p.submission_id,'attempted');f.store.setItem('earth-recharge-submitted-v1:'+sent.submission_id,'sent');f.queue.recover(p);f.queue.recover(sent);await f.queue.flush();assert.equal(calls,1);assert.equal(f.queue.inspect().length,0);
 f.queue.recover(null);await f.queue.flush();assert.equal(calls,1);
});

test('new test does not clear previous failed records; secure UUID fallback remains v4',async()=>{
 const f=fixture({online:()=>false}),a=payload(),b=payload();f.queue.enqueue(a);f.queue.enqueue(b);assert.equal(f.queue.inspect().length,2);assert.notEqual(a.submission_id,b.submission_id);
 const fallback=createSubmission(questions,a.answers,{getRandomValues:webcrypto.getRandomValues.bind(webcrypto)});assert.match(fallback.submission_id,/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
});

test('server ACK and failure classification never report ok for database rejection',async()=>{
 const p=payload(),origin='https://73ya73.github.io';const req=()=>new Request('https://test.invalid',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(p)});
 for(const [category,status] of [['permission',403],['database_rejected',422],['id_conflict',409],['database',503],['timeout',503],['network',503]]){
  const h=createHandler({origins:[origin],logger:{error(){}},insert:async()=>{throw Object.assign(Error('secret SQL'),{category});}});const r=await h(req());assert.equal(r.status,status);const body=await r.json();assert.equal(body.ok,undefined);assert.equal(body.error,category);assert.equal(body.submission_id,p.submission_id);assert.equal(JSON.stringify(body).includes('secret'),false);
 }
 for(const status of ['inserted','already_saved']){const h=createHandler({origins:[origin],logger:{info(){}},insert:async()=>status});assert.deepEqual(await (await h(req())).json(),{ok:true,status,submission_id:p.submission_id});}
 const old=createHandler({origins:[origin],logger:{error(){}},insert:async()=> 'accepted'});assert.equal((await old(req())).status,503);
});

test('online event resumes queue and automatic timers stop after finite retry budget',async()=>{
 let connected=false,calls=0;const target=new EventTarget();const f=fixture({online:()=>connected,now:Date.now,baseDelayMs:1,fetcher:async()=>{calls++;throw Error('network');}});f.queue.enqueue(payload());const stop=f.queue.start(target);
 await new Promise(r=>setTimeout(r,10));assert.equal(calls,0);connected=true;target.dispatchEvent(new Event('online'));
 await new Promise(r=>setTimeout(r,120));assert.equal(calls,3);assert.equal(f.queue.inspect()[0].status,'failed');target.dispatchEvent(new Event('online'));await new Promise(r=>setTimeout(r,30));assert.equal(calls,3);stop();
});

test('Web Locks serializes two tabs; shared storage and DB ID remain stable',async()=>{
 const p=payload(),store=storage();let locked=false,calls=0;
 const locks={async request(_name,_options,fn){if(locked)return fn(null);locked=true;try{return await fn({});}finally{locked=false;}}};
 const config={endpoint:'https://test.invalid',storage:store,locks,fetcher:async()=>{calls++;await new Promise(r=>setTimeout(r,10));return response(p);}};
 const a=createResearchQueue(config),b=createResearchQueue(config);a.enqueue(p);b.enqueue(p);await Promise.all([a.flush(),b.flush()]);await b.flush();assert.equal(calls,1);assert.equal(a.inspect().length,0);assert.equal(b.inspect().length,0);
});

test('blocked local storage warns and still allows in-page results/upload without claiming durability',async()=>{
 const logs=[],p=payload(),broken={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();},get length(){throw Error();}};
 const q=createResearchQueue({endpoint:'https://test.invalid',storage:broken,logger:{warn:(...x)=>logs.push(x)},fetcher:async()=>response(p)});q.enqueue(p);assert.equal((await q.flush())[0].status,'saved');assert.ok(logs.flat().some(x=>String(x).includes('local_storage_unavailable')));
});

async function exhaust(f,queue=f.queue){
 await queue.flush();f.advance(1000);await queue.flush();f.advance(2000);await queue.flush();
 assert.equal(queue.inspect()[0].status,'failed');
}

test('new visits respect 30-minute cooldown; 3 rounds stop at 9 and keep exact payload forever',async()=>{
 const p=payload(),ids=[];const f=fixture({fetcher:async(_u,o)=>{ids.push(JSON.parse(o.body).submission_id);throw Error('network');}});f.queue.enqueue(p);await exhaust(f);
 let visit=createResearchQueue(f.config);visit.recover();await visit.flush();assert.equal(ids.length,3);
 f.advance(RECOVERY_COOLDOWN_MS-1);await visit.flush();assert.equal(ids.length,3);
 f.advance(1);await exhaust(f,visit);assert.equal(ids.length,6);assert.equal(visit.inspect()[0].round,2);
 // A timer/ordinary flush alone must never open another round.
 f.advance(RECOVERY_COOLDOWN_MS*2);await visit.flush();assert.equal(ids.length,6);
 visit=createResearchQueue(f.config);visit.recover();await exhaust(f,visit);assert.equal(ids.length,9);
 for(let i=0;i<4;i++){f.advance(RECOVERY_COOLDOWN_MS);const next=createResearchQueue(f.config);next.recover(p);await next.flush();}
 assert.equal(ids.length,9);assert.ok(ids.every(id=>id===p.submission_id));const final=visit.inspect()[0];assert.equal(final.round,3);assert.equal(final.totalAttempts,9);assert.equal(final.attempts,3);assert.deepEqual(final.payload,p);assert.ok(f.store.getItem(OUTBOX_PREFIX+p.submission_id));
});

test('new round after lost server replies uses original ID and already_saved clears only confirmed record',async()=>{
 const p=payload(),rows=new Map(),ids=[];let lose=true;
 const f=fixture({fetcher:async(_u,o)=>{const record=JSON.parse(o.body);ids.push(record.submission_id);rows.set(record.submission_id,record);if(lose)throw Error('response lost');return response(record,'already_saved');}});
 f.queue.enqueue(p);await exhaust(f);assert.equal(rows.size,1);assert.equal(f.queue.inspect()[0].status,'failed');
 f.advance(RECOVERY_COOLDOWN_MS);lose=false;const visit=createResearchQueue(f.config);visit.recover();await visit.flush();assert.equal(ids.length,4);assert.ok(ids.every(id=>id===p.submission_id));assert.equal(rows.size,1);assert.equal(visit.inspect().length,0);
});

test('offline-to-online can authorize one cooled round; repeated online events cannot authorize another',async()=>{
 let connected=true,calls=0;const f=fixture({online:()=>connected,fetcher:async()=>{calls++;throw Error('network');}});f.queue.enqueue(payload());await exhaust(f);
 const target=new EventTarget(),stop=f.queue.start(target);
 // Startup authorizes round 2 after cooldown, but offline never consumes attempts.
 connected=false;target.dispatchEvent(new Event('offline'));f.advance(RECOVERY_COOLDOWN_MS);await f.queue.flush();assert.equal(calls,3);
 connected=true;target.dispatchEvent(new Event('online'));await new Promise(r=>setTimeout(r,5));assert.equal(calls,4);
 f.advance(1000);await f.queue.flush();f.advance(2000);await f.queue.flush();assert.equal(calls,6);
 f.advance(RECOVERY_COOLDOWN_MS);target.dispatchEvent(new Event('online'));await new Promise(r=>setTimeout(r,5));assert.equal(calls,6);
 connected=false;target.dispatchEvent(new Event('offline'));connected=true;target.dispatchEvent(new Event('online'));await new Promise(r=>setTimeout(r,5));assert.equal(calls,7);stop();
});

test('legacy failed entries migrate once; deterministic errors and invalid ACK never restart',async()=>{
 for(const [error,httpStatus,retryable] of [['network',null,true],['timeout',null,true],['database',503,true],['permission',403,false],['id_conflict',409,false],['invalid_submission',400,false],['invalid_ack',200,false]]){
  const p=payload();let calls=0;const f=fixture({fetcher:async()=>{calls++;return response(p,'already_saved');}});
  f.store.setItem(OUTBOX_PREFIX+p.submission_id,JSON.stringify({payload:p,status:'failed',attempts:3,error,httpStatus,inflightUntil:0,nextAttemptAt:0}));
  f.queue.recover();const migrated=f.queue.inspect()[0];assert.equal(migrated.retryable,retryable);assert.equal(migrated.totalAttempts,3);await f.queue.flush();assert.equal(calls,0);
  f.advance(RECOVERY_COOLDOWN_MS-1);const visit=createResearchQueue(f.config);visit.recover();await visit.flush();assert.equal(calls,0);
  f.advance(1);await visit.flush();assert.equal(calls,retryable?1:0);if(!retryable)assert.deepEqual(visit.inspect()[0].payload,p);
 }
});

test('new deterministic failures stop within first round even after later recovery triggers',async()=>{
 for(const status of [400,401,403,409,422]){
  let calls=0;const f=fixture({fetcher:async()=>{calls++;return new Response('{}',{status});}});f.queue.enqueue(payload());await f.queue.flush();
  f.advance(RECOVERY_COOLDOWN_MS);const visit=createResearchQueue(f.config);visit.recover();await visit.flush();assert.equal(calls,1);assert.equal(visit.inspect()[0].retryable,false);
 }
});

test('cross-tab recovery tickets are bound to failed round and cannot revive a later round',async()=>{
 let calls=0;const f=fixture({fetcher:async()=>{calls++;throw Error('network');}});f.queue.enqueue(payload());await exhaust(f);
 const a=createResearchQueue(f.config),b=createResearchQueue(f.config);a.recover();b.recover();f.advance(RECOVERY_COOLDOWN_MS);await exhaust(f,a);assert.equal(calls,6);
 f.advance(RECOVERY_COOLDOWN_MS);await b.flush();assert.equal(calls,6);
 b.recover();await b.flush();assert.equal(calls,7);
});

test('read-only summary/subscription exposes counts and status without answers; success still observable',async()=>{
 const p=payload(),f=fixture({fetcher:async()=>response(p)});let changes=0;const unsubscribe=f.queue.subscribe(()=>changes++);
 f.queue.enqueue(p);assert.equal(f.queue.summary().pending,1);await f.queue.flush();assert.equal(f.queue.summary().pending,0);assert.equal(f.queue.summary().last.status,'saved');assert.equal(f.queue.summary().last.http_status,200);assert.ok(changes>=3);assert.equal(JSON.stringify(f.queue.summary()).includes('answers'),false);
 unsubscribe();const before=changes;f.queue.enqueue(payload());assert.equal(changes,before);
});

test('one recovery trigger schedules one cooldown check, never recurring rounds',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:100});
 const settle=()=>new Promise(resolve=>setImmediate(resolve));let calls=0;
 const f=fixture({now:Date.now,fetcher:async()=>{calls++;throw Error('network');}});f.queue.enqueue(payload());
 const stop=f.queue.start(new EventTarget());await settle();t.mock.timers.tick(1000);await settle();t.mock.timers.tick(2000);await settle();assert.equal(calls,3);
 t.mock.timers.tick(RECOVERY_COOLDOWN_MS);await settle();assert.equal(calls,3);
 // A new visit authorizes exactly one round, including when cooldown isn't done yet.
 const visit=createResearchQueue(f.config),stopVisit=visit.start(new EventTarget());await settle();assert.equal(calls,4);
 t.mock.timers.tick(1000);await settle();t.mock.timers.tick(2000);await settle();assert.equal(calls,6);stopVisit();
 const next=createResearchQueue(f.config),stopNext=next.start(new EventTarget());await settle();assert.equal(calls,6);
 t.mock.timers.tick(RECOVERY_COOLDOWN_MS-1);await settle();assert.equal(calls,6);
 t.mock.timers.tick(1);await settle();assert.equal(calls,7);
 t.mock.timers.tick(1000);await settle();t.mock.timers.tick(2000);await settle();assert.equal(calls,9);
 t.mock.timers.tick(RECOVERY_COOLDOWN_MS*10);await settle();assert.equal(calls,9);assert.equal(next.inspect()[0].status,'failed');assert.ok(next.inspect()[0].payload.answers.Q13);stop();stopNext();
});

test('closing during ninth request never permits a tenth attempt after lease or future visits',async()=>{
 let calls=0;const p=payload(),f=fixture({fetcher:async()=>{calls++;return response(p);}});
 f.store.setItem(OUTBOX_PREFIX+p.submission_id,JSON.stringify({payload:p,queueVersion:3,status:'pending',round:3,attempts:3,totalAttempts:9,retryable:true,inflightUntil:17100,nextAttemptAt:0}));
 const visit=createResearchQueue(f.config);visit.recover();await visit.flush();assert.equal(calls,0);f.advance(17001);await visit.flush();assert.equal(visit.inspect()[0].status,'failed');
 f.advance(RECOVERY_COOLDOWN_MS);const next=createResearchQueue(f.config);next.recover();await next.flush();assert.equal(calls,0);assert.deepEqual(next.inspect()[0].payload,p);
});

test('two tabs recovering same failed round serialize one already_saved confirmation',async()=>{
 let locked=false,available=false,calls=0;
 const locks={async request(_key,_options,fn){if(locked)return fn(null);locked=true;try{return await fn({});}finally{locked=false;}}};
 const p=payload(),f=fixture({locks,fetcher:async()=>{calls++;if(!available)throw Error('network');await new Promise(r=>setTimeout(r,10));return response(p,'already_saved');}});
 f.queue.enqueue(p);await exhaust(f);f.advance(RECOVERY_COOLDOWN_MS);available=true;
 const a=createResearchQueue(f.config),b=createResearchQueue(f.config);a.recover();b.recover();await Promise.all([a.flush(),b.flush()]);await b.flush();assert.equal(calls,4);assert.equal(a.inspect().length,0);assert.equal(b.inspect().length,0);
});
