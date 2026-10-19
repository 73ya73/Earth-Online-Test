import {answerIds,complete} from '../scoring/answers.js';
import {calculate} from '../scoring/engine.js';

// No browser identifier: this UUID identifies one completed test only.
export function createSubmission(questions,answers,crypto=globalThis.crypto){
 if(!complete(questions,answers))return null;
 let id;
 if(crypto.randomUUID)id=crypto.randomUUID();
 else {const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');id=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
 const result=calculate(questions,answers);
 return {submission_id:id,submitted_at:new Date().toISOString(),answers:Object.fromEntries(questions.map(q=>[q.questionId,answerIds(q,answers[q.questionId])])),result_type:result.status==='exploring'?['EXPLORING']:result.candidates.map(c=>c.key),scores:result.totals};
}
export function researchConfig(env){
 const enabled=env.VITE_RESEARCH_ENABLED==='true',endpoint=env.VITE_RESEARCH_FUNCTION_URL||'';
 if(!enabled)return {enabled:false,endpoint:''};
 try{const url=new URL(endpoint);if(url.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol==='http:'))throw Error();if(url.username||url.password||url.search||url.hash)throw Error();return {enabled:true,endpoint:url.href};}catch{return {enabled:false,endpoint:'',invalid:true};}
}
