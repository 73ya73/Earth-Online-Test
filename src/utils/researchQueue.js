export const OUTBOX_PREFIX='earth-recharge-outbox-v2:';
const RECEIPT_PREFIX='earth-recharge-submitted-v1:';
export const RECOVERY_COOLDOWN_MS=30*60*1000;
const MAX_ROUNDS=3;
const RETRY_HTTP=[408,429,500,502,503,504];
const PERMANENT_ERRORS=['permission','id_conflict','database_rejected','invalid_submission','origin_not_allowed','invalid_ack'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Per-record keys avoid one tab overwriting another tab's entire queue.
// Failed payloads remain intact; recovery needs a new visit/network transition AND a cooldown.
export function createResearchQueue({endpoint,storage,fetcher=(...args)=>globalThis.fetch(...args),logger=console,debug=false,
 now=Date.now,online=()=>globalThis.navigator?.onLine!==false,timeoutMs=15000,maxAttempts=3,
 baseDelayMs=1000,random=Math.random,locks=globalThis.navigator?.locks,onStatus=()=>{},endpointFor}={}){
 if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
 const memory=new Map(),active=new Map(),recoveryTickets=new Map(),listeners=new Set();let timer,stopped=true,lastStatus=null;
 const destination=payload=>endpointFor?endpointFor(payload):endpoint;
 const notify=()=>{for(const listener of listeners){try{listener();}catch{}}};
 const log=(entry,extra={})=>{const data={submission_id:entry.payload.submission_id,status:entry.status,attempts:entry.attempts,round:entry.round,total_attempts:entry.totalAttempts,http_status:entry.httpStatus||null,duration_ms:entry.durationMs||0,error_category:entry.error||null,...extra};if(debug)logger.debug?.('[Earth Online] research',data);else if(entry.status==='failed')logger.warn?.('[Earth Online] research',data);lastStatus=data;try{onStatus(data);}catch{}notify();};
 function get(key){try{return storage?.getItem(key)||memory.get(key)||null;}catch{return memory.get(key)||null;}}
 function put(key,value){memory.set(key,value);try{if(!storage)throw Error();storage.setItem(key,value);return true;}catch{logger.warn?.('[Earth Online] research local_storage_unavailable');return false;}}
 function remove(key){memory.delete(key);try{storage?.removeItem(key);}catch{}}
 function entries(){const keys=new Set(memory.keys());try{for(let i=0;i<storage.length;i++)keys.add(storage.key(i));}catch{}const result=[];for(const key of keys){if(!key?.startsWith(OUTBOX_PREFIX))continue;try{const e=JSON.parse(get(key));if(UUID.test(e?.payload?.submission_id)&&key===OUTBOX_PREFIX+e.payload.submission_id&&Number.isInteger(e.attempts)&&e.attempts>=0)result.push(normalize(e,key));}catch{logger.warn?.('[Earth Online] research invalid_local_entry');}}return result;}
 function normalize(entry,key){
  if(entry.queueVersion===3)return entry;
  // Old failed records have no reliable failure time: migrate once, then cool down.
  const retryable=!PERMANENT_ERRORS.includes(entry.error)&&(
   ['network','timeout','retry_exhausted'].includes(entry.error)||RETRY_HTTP.includes(entry.httpStatus));
  const migrated={...entry,queueVersion:3,round:1,totalAttempts:entry.attempts,retryable,
   failedAt:entry.status==='failed'?now():0,
   nextRecoveryAt:entry.status==='failed'&&retryable?Math.max(now()+RECOVERY_COOLDOWN_MS,entry.nextAttemptAt||0):0};
  put(key,JSON.stringify(migrated));return migrated;
 }
 function canRecover(entry){return entry.status==='failed'&&entry.retryable&&!PERMANENT_ERRORS.includes(entry.error)&&entry.round<MAX_ROUNDS&&entry.totalAttempts<maxAttempts*MAX_ROUNDS;}
 function write(entry){entry.updatedAt=now();return put(OUTBOX_PREFIX+entry.payload.submission_id,JSON.stringify(entry));}
 function receipt(id){return get(RECEIPT_PREFIX+id)==='sent';}
 function enqueue(payload){
  if(!payload||!UUID.test(payload.submission_id))return {status:'failed',error:'invalid_local_record'};
  const id=payload.submission_id;if(receipt(id))return {status:'saved',submission_id:id};
  const existing=entries().find(e=>e.payload.submission_id===id);if(existing)return existing;
  const entry={payload:JSON.parse(JSON.stringify(payload)),status:'pending',queueVersion:3,round:1,attempts:0,totalAttempts:0,retryable:false,failedAt:0,nextRecoveryAt:0,nextAttemptAt:0,inflightUntil:0};
  const durable=write(entry);log(entry,{durable});return entry;
 }
 function schedule(){
  clearTimeout(timer);if(stopped||!online())return;
  const due=entries().filter(e=>destination(e.payload)&&!active.has(e.payload.submission_id)&&(e.status==='pending'||(recoveryTickets.get(e.payload.submission_id)===e.round&&canRecover(e)))).map(e=>Math.max(e.status==='failed'?e.nextRecoveryAt||0:e.nextAttemptAt||0,e.inflightUntil||0));
  if(due.length)timer=setTimeout(()=>void flush(),Math.min(2147483647,Math.max(20,Math.min(...due)-now())));
 }
 async function attempt(id){
  let entry=entries().find(e=>e.payload.submission_id===id);if(!entry)return;
  if(receipt(id)){remove(OUTBOX_PREFIX+id);return {status:'saved',submission_id:id};}
  if(entry.status==='saved'){
   if(put(RECEIPT_PREFIX+id,'sent'))remove(OUTBOX_PREFIX+id);return entry;
  }
  const targetEndpoint=destination(entry.payload);
  if(!targetEndpoint||!online())return entry;
  if(entry.status==='failed'){
   if(recoveryTickets.get(id)!==entry.round||!canRecover(entry)||now()<Math.max(entry.nextRecoveryAt||0,entry.inflightUntil||0))return entry;
   recoveryTickets.delete(id);
   entry={...entry,status:'pending',round:entry.round+1,attempts:0,nextAttemptAt:0,nextRecoveryAt:0,failedAt:0};write(entry);log(entry);
  }
  if(now()<Math.max(entry.nextAttemptAt||0,entry.inflightUntil||0))return entry;
  if(entry.attempts>=maxAttempts||entry.totalAttempts>=maxAttempts*MAX_ROUNDS){entry={...entry,status:'failed',error:'retry_exhausted',retryable:true,failedAt:now(),nextRecoveryAt:now()+RECOVERY_COOLDOWN_MS,inflightUntil:0};write(entry);log(entry);return entry;}
  const started=now();entry={...entry,status:'pending',attempts:entry.attempts+1,totalAttempts:entry.totalAttempts+1,retryable:true,inflightUntil:started+timeoutMs+2000,httpStatus:null,durationMs:0,error:null};write(entry);log(entry);
  let httpStatus=null,error,retry=false,retryAfter=0,timeout;
  try{
   const controller=new AbortController();timeout=setTimeout(()=>controller.abort(),timeoutMs);
   const response=await fetcher(targetEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry.payload),credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
   httpStatus=response.status;
   if(!response.ok){
    retry=RETRY_HTTP.includes(httpStatus);
    error=httpStatus===408?'timeout':httpStatus===429?'rate_limited':[401,403].includes(httpStatus)?'permission':httpStatus===409?'id_conflict':httpStatus>=500?'database_or_server':'invalid_submission';
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
    error='invalid_ack';retry=false;
   }
  }catch(e){error=e?.name==='AbortError'?'timeout':e instanceof SyntaxError?'invalid_ack':'network';retry=error!=='invalid_ack';}
  finally{clearTimeout(timeout);}
  if(PERMANENT_ERRORS.includes(error))retry=false;
  const delay=Math.max(retryAfter,baseDelayMs*2**(entry.attempts-1)*(1+random()*0.25));
  entry={...entry,status:retry&&entry.attempts<maxAttempts?'pending':'failed',error,httpStatus,durationMs:now()-started,inflightUntil:0,nextAttemptAt:now()+delay,retryable:retry,failedAt:retry&&entry.attempts<maxAttempts?0:now(),nextRecoveryAt:retry&&entry.attempts>=maxAttempts?Math.max(now()+RECOVERY_COOLDOWN_MS,now()+delay):0};write(entry);log(entry);return entry;
 }
 function send(id){
  if(active.has(id))return active.get(id);
  const task=Promise.resolve().then(()=>locks?.request?locks.request('earth-research:'+id,{ifAvailable:true},lock=>lock?attempt(id):undefined):attempt(id)).catch(()=>{logger.warn?.('[Earth Online] research queue_error');}).finally(()=>{active.delete(id);schedule();});active.set(id,task);return task;
 }
 async function flush(){if(!endpoint&&!endpointFor)return [];try{return await Promise.all(entries().filter(e=>e.status==='pending'||e.status==='saved'||(recoveryTickets.get(e.payload.submission_id)===e.round&&canRecover(e))).map(e=>send(e.payload.submission_id)));}finally{schedule();}}
 function recover(payload){if(payload)enqueue(payload);const records=entries();for(const entry of records)if(canRecover(entry))recoveryTickets.set(entry.payload.submission_id,entry.round);notify();return records;}
 function start(target=globalThis.window){
  stopped=false;let wasOnline=online();
  const run=()=>void flush();
  const onOffline=()=>{wasOnline=false;};
  const onOnline=()=>{const connected=online();if(connected&&!wasOnline)recover();wasOnline=connected;run();};
  const onShow=event=>{if(event.persisted)recover();run();};
  const visible=()=>{if(target?.document?.visibilityState==='visible')run();};
  const onStorage=()=>{notify();run();};
  target?.addEventListener('offline',onOffline);target?.addEventListener('online',onOnline);
  target?.addEventListener('pageshow',onShow);target?.addEventListener('storage',onStorage);
  target?.document?.addEventListener('visibilitychange',visible);recover();run();
  return ()=>{stopped=true;clearTimeout(timer);recoveryTickets.clear();target?.removeEventListener('offline',onOffline);target?.removeEventListener('online',onOnline);target?.removeEventListener('pageshow',onShow);target?.removeEventListener('storage',onStorage);target?.document?.removeEventListener('visibilitychange',visible);};
 }
 function summary(){
  const records=entries(),recent=records.slice().sort((a,b)=>(b.updatedAt||b.failedAt||0)-(a.updatedAt||a.failedAt||0))[0];
  const last=lastStatus||(recent?{status:recent.status,http_status:recent.httpStatus||null,error_category:recent.error||null,round:recent.round,attempts:recent.attempts,total_attempts:recent.totalAttempts}:null);
  return {pending:records.filter(e=>e.status==='pending').length,failed:records.filter(e=>e.status==='failed').length,last};
 }
 function subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);}

 return {enqueue,recover,flush,start,inspect:entries,summary,subscribe};
}
