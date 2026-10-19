export const OUTBOX_PREFIX='earth-recharge-outbox-v2:';
const RECEIPT_PREFIX='earth-recharge-submitted-v1:';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Per-record keys avoid one tab overwriting another tab's entire queue.
// Failed entries stay available for diagnosis; visits never reset their budget.
export function createResearchQueue({endpoint,storage,fetcher=(...args)=>globalThis.fetch(...args),logger=console,debug=false,
 now=Date.now,online=()=>globalThis.navigator?.onLine!==false,timeoutMs=15000,maxAttempts=3,
 baseDelayMs=1000,random=Math.random,locks=globalThis.navigator?.locks,onStatus=()=>{}}={}){
 if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
 const memory=new Map(),active=new Map();let timer,stopped=true;
 const log=(entry,extra={})=>{const data={submission_id:entry.payload.submission_id,status:entry.status,attempts:entry.attempts,http_status:entry.httpStatus||null,duration_ms:entry.durationMs||0,error_category:entry.error||null,...extra};if(debug)logger.debug?.('[Earth Online] research',data);else if(entry.status==='failed')logger.warn?.('[Earth Online] research',data);try{onStatus(data);}catch{}};
 function get(key){try{return storage?.getItem(key)||memory.get(key)||null;}catch{return memory.get(key)||null;}}
 function put(key,value){memory.set(key,value);try{if(!storage)throw Error();storage.setItem(key,value);return true;}catch{logger.warn?.('[Earth Online] research local_storage_unavailable');return false;}}
 function remove(key){memory.delete(key);try{storage?.removeItem(key);}catch{}}
 function entries(){const keys=new Set(memory.keys());try{for(let i=0;i<storage.length;i++)keys.add(storage.key(i));}catch{}const result=[];for(const key of keys){if(!key?.startsWith(OUTBOX_PREFIX))continue;try{const e=JSON.parse(get(key));if(UUID.test(e?.payload?.submission_id)&&key===OUTBOX_PREFIX+e.payload.submission_id&&Number.isInteger(e.attempts)&&e.attempts>=0)result.push(e);}catch{logger.warn?.('[Earth Online] research invalid_local_entry');}}return result;}
 function write(entry){return put(OUTBOX_PREFIX+entry.payload.submission_id,JSON.stringify(entry));}
 function receipt(id){return get(RECEIPT_PREFIX+id)==='sent';}
 function enqueue(payload){
  if(!payload||!UUID.test(payload.submission_id))return {status:'failed',error:'invalid_local_record'};
  const id=payload.submission_id;if(receipt(id))return {status:'saved',submission_id:id};
  const existing=entries().find(e=>e.payload.submission_id===id);if(existing)return existing;
  const entry={payload:JSON.parse(JSON.stringify(payload)),status:'pending',attempts:0,nextAttemptAt:0,inflightUntil:0};
  const durable=write(entry);log(entry,{durable});return entry;
 }
 function schedule(){
  clearTimeout(timer);if(stopped||!online())return;
  const due=entries().filter(e=>e.status==='pending'&&!active.has(e.payload.submission_id)).map(e=>Math.max(e.nextAttemptAt||0,e.inflightUntil||0));
  if(due.length)timer=setTimeout(()=>void flush(),Math.min(2147483647,Math.max(20,Math.min(...due)-now())));
 }
 async function attempt(id){
  let entry=entries().find(e=>e.payload.submission_id===id);if(!entry)return;
  if(receipt(id)){remove(OUTBOX_PREFIX+id);return {status:'saved',submission_id:id};}
  if(entry.status==='saved'){
   if(put(RECEIPT_PREFIX+id,'sent'))remove(OUTBOX_PREFIX+id);return entry;
  }
  if(entry.status==='failed'||!online()||now()<Math.max(entry.nextAttemptAt||0,entry.inflightUntil||0))return entry;
  if(entry.attempts>=maxAttempts){entry={...entry,status:'failed',error:'retry_exhausted',inflightUntil:0};write(entry);log(entry);return entry;}
  const started=now();entry={...entry,status:'pending',attempts:entry.attempts+1,inflightUntil:started+timeoutMs+2000,httpStatus:null,durationMs:0,error:null};write(entry);log(entry);
  let httpStatus=null,error,retry=false,retryAfter=0,timeout;
  try{
   const controller=new AbortController();timeout=setTimeout(()=>controller.abort(),timeoutMs);
   const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry.payload),credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
   httpStatus=response.status;
   if(!response.ok){
    retry=[408,429,500,502,503,504].includes(httpStatus);
    error=httpStatus===429?'rate_limited':[401,403].includes(httpStatus)?'permission':httpStatus===409?'id_conflict':httpStatus>=500?'database_or_server':'invalid_submission';
    // Read only a fixed error enum, never log raw response bodies.
    try{const body=await response.json();if(['rate_limited','permission','id_conflict','database_rejected','database','timeout','network','invalid_submission','origin_not_allowed'].includes(body?.error))error=body.error;}catch{}
    const header=response.headers?.get('Retry-After');if(header){const seconds=Number(header);retryAfter=Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(header)-now())||0;}
   }else{
    const ack=await response.json();
    if(ack?.ok===true&&ack.submission_id===id&&['inserted','already_saved'].includes(ack.status)){
     entry={...entry,status:'saved',httpStatus,durationMs:now()-started,inflightUntil:0,error:null};
     // Persist confirmation before removing the payload. A lost response remains retryable.
     write(entry);if(put(RECEIPT_PREFIX+id,'sent'))remove(OUTBOX_PREFIX+id);log(entry,{save_result:ack.status});return entry;
    }
    error='invalid_ack';retry=true;
   }
  }catch(e){error=e?.name==='AbortError'?'timeout':e instanceof SyntaxError?'invalid_ack':'network';retry=true;}
  finally{clearTimeout(timeout);}
  const delay=Math.max(retryAfter,baseDelayMs*2**(entry.attempts-1)*(1+random()*0.25));
  entry={...entry,status:retry&&entry.attempts<maxAttempts?'pending':'failed',error,httpStatus,durationMs:now()-started,inflightUntil:0,nextAttemptAt:now()+delay};write(entry);log(entry);return entry;
 }
 function send(id){
  if(active.has(id))return active.get(id);
  const task=Promise.resolve().then(()=>locks?.request?locks.request('earth-research:'+id,{ifAvailable:true},lock=>lock?attempt(id):undefined):attempt(id)).catch(()=>{logger.warn?.('[Earth Online] research queue_error');}).finally(()=>{active.delete(id);schedule();});active.set(id,task);return task;
 }
 async function flush(){if(!endpoint)return [];try{return await Promise.all(entries().filter(e=>e.status==='pending'||e.status==='saved').map(e=>send(e.payload.submission_id)));}finally{schedule();}}
 function recover(payload){if(payload)enqueue(payload);return entries();}
 function start(target=globalThis.window){stopped=false;const run=()=>void flush();const visible=()=>{if(target?.document?.visibilityState==='visible')run();};target?.addEventListener('online',run);target?.addEventListener('pageshow',run);target?.addEventListener('storage',run);target?.document?.addEventListener('visibilitychange',visible);run();return ()=>{stopped=true;clearTimeout(timer);target?.removeEventListener('online',run);target?.removeEventListener('pageshow',run);target?.removeEventListener('storage',run);target?.document?.removeEventListener('visibilitychange',visible);};}
 return {enqueue,recover,flush,start,inspect:entries};
}
