import {validateSubmission} from './research.js';
const MAX_BYTES=8192;
async function readLimited(request){
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_body');
 const chunks=[];let total=0;
 let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;void reader.cancel().catch(()=>{});},3000);
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();throw Error('too_large');}chunks.push(value);}
 if(timedOut)throw Error('body_timeout');
 const bytes=new Uint8Array(total);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{clearTimeout(timer);reader.releaseLock();}
}
export function createHandler({origins,insert,logger=console,now=()=>new Date(),validate=validateSubmission}){
 // Per-isolate early cap also limits malformed requests; database cap is global.
 let minute=-1,count=0;
 return async request=>{
  const origin=request.headers.get('origin'),allowed=origins.includes(origin);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(allowed)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type','Access-Control-Max-Age':'600','Access-Control-Expose-Headers':'Retry-After'});
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...headers,...(status===429?{'Retry-After':'60'}:{})}});
  if(!allowed)return reply(403,{error:'origin_not_allowed'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
  const current=Math.floor(now().getTime()/60000);if(current!==minute){minute=current;count=0;}if(++count>120)return reply(429,{error:'rate_limited'});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return reply(415,{error:'json_required'});
  if(Number(request.headers.get('content-length'))>MAX_BYTES)return reply(413,{error:'too_large'});
  let record;
  try{record=validate(await readLimited(request),now());}catch(error){logger.warn?.('[Earth Online] research', {status:'failed',category:'validation',reason:['invalid_record','invalid_time','invalid_questions','invalid_answers','invalid_scores','result_mismatch','score_mismatch','too_large','body_timeout'].includes(error.message)?error.message:'invalid_body'});return reply(error.message==='too_large'?413:400,{error:'invalid_submission'});}
  const started=Date.now();
  const diagnostic=(status,category,extra={})=>({submission_id:record.submission_id,status,category,duration_ms:Date.now()-started,...extra});
  try{
   const outcome=await insert(record);
   if(outcome==='rate_limited'){logger.warn?.('[Earth Online] research',diagnostic('pending','rate_limited',{http_status:429}));return reply(429,{error:'rate_limited',submission_id:record.submission_id});}
   if(!['inserted','already_saved'].includes(outcome))throw Object.assign(Error('invalid_rpc_ack'),{category:'database'});
   logger.info?.('[Earth Online] research',diagnostic('saved',outcome,{http_status:200}));
   return reply(200,{ok:true,submission_id:record.submission_id,status:outcome});
  }catch(error){
   const category=['id_conflict','permission','database_rejected','database','timeout','network'].includes(error.category)?error.category:'database';
   const status=category==='id_conflict'?409:category==='permission'?403:category==='database_rejected'?422:503;
   logger.error?.('[Earth Online] research',diagnostic('failed',category,{http_status:status,upstream_status:error.upstreamStatus||null,db_code:error.dbCode||null}));
   return reply(status,{error:category,submission_id:record.submission_id});
  }
 };
}
