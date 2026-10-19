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
export function createHandler({origins,insert,logger=console,now=()=>new Date()}){
 // Per-isolate early cap also limits malformed requests; database cap is global.
 let minute=-1,count=0;
 return async request=>{
  const origin=request.headers.get('origin'),allowed=origins.includes(origin);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(allowed)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type','Access-Control-Max-Age':'600'});
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(!allowed)return reply(403,{error:'origin_not_allowed'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
  const current=Math.floor(now().getTime()/60000);if(current!==minute){minute=current;count=0;}if(++count>120)return reply(429,{error:'rate_limited'});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return reply(415,{error:'json_required'});
  if(Number(request.headers.get('content-length'))>MAX_BYTES)return reply(413,{error:'too_large'});
  let record;
  try{record=validateSubmission(await readLimited(request),now());}catch(error){return reply(error.message==='too_large'?413:400,{error:'invalid_submission'});}
  try{
   const outcome=await insert(record);
   if(outcome==='rate_limited')return reply(429,{error:'rate_limited'});
   if(outcome!=='accepted')throw Error('unexpected_response');
   // No SELECT endpoint, existing rows, duplicate details or database errors leak.
   return reply(200,{ok:true});
  }catch{logger.error('[Earth Online] submission storage failed');return reply(503,{error:'temporarily_unavailable'});}
 };
}
