import {answerIds,complete} from '../scoring/answers.js';
import {calculate} from '../scoring/engine.js';

// No browser identifier: this UUID identifies one completed test only.
export function createSubmission(questions,answers,crypto=globalThis.crypto){
 if(!complete(questions,answers))return null;
 const result=calculate(questions,answers);
 return {submission_id:crypto.randomUUID(),submitted_at:new Date().toISOString(),answers:Object.fromEntries(questions.map(q=>[q.questionId,answerIds(q,answers[q.questionId])])),result_type:result.status==='exploring'?['EXPLORING']:result.candidates.map(c=>c.key),scores:result.totals};
}
export function researchConfig(env){
 const enabled=env.VITE_RESEARCH_ENABLED==='true',endpoint=env.VITE_RESEARCH_FUNCTION_URL||'';
 if(!enabled)return {enabled:false,endpoint:''};
 try{const url=new URL(endpoint);if(url.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol==='http:'))throw Error();if(url.username||url.password||url.search||url.hash)throw Error();return {enabled:true,endpoint:url.href};}catch{return {enabled:false,endpoint:'',invalid:true};}
}
const attempted=new Set();
const PREFIX='earth-recharge-submitted-v1:';
export async function submitOnce(payload,{endpoint,fetcher=globalThis.fetch,storage,logger=console,timeoutMs=7000}={}){
 if(!endpoint||!payload)return {status:'disabled'};
 const id=payload.submission_id,key=PREFIX+id;
 if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
 if(attempted.has(id))return {status:'skipped'};
 try{if(storage?.getItem(key))return {status:'skipped'};}catch{}
 attempted.add(id);
 // Mark before sending: refresh/re-entry never causes an automatic retry loop.
 try{storage?.setItem(key,'attempted');}catch{}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
  if(!response.ok)throw new Error(`http_${response.status}`);
  const ack=await response.json();if(ack?.ok!==true)throw new Error('invalid_ack');
  try{storage?.setItem(key,'sent');}catch{}
  return {status:'sent'};
 }catch(error){
  // Never log answer data, UUID, endpoint, exception bodies or network headers.
  const code=error?.name==='AbortError'?'timeout':/^http_\d+$/.test(error?.message)?error.message:'network_or_response';
  logger.warn('[Earth Online] statistical submission failed:',code);
  return {status:'failed',code};
 }finally{clearTimeout(timer);}
}
