import questions from './questions.js';
import {answerIds} from './scoring/answers.js';
import {calculate,KEYS} from './scoring/engine.js';
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function validateSubmission(input,now=new Date()){
 if(!exact(input,['submission_id','submitted_at','answers','result_type','scores'])||!UUID.test(input.submission_id))throw Error('invalid_record');
 if(typeof input.submitted_at!=='string'||!Number.isFinite(Date.parse(input.submitted_at)))throw Error('invalid_time');
 if(!exact(input.answers,questions.map(q=>q.questionId)))throw Error('invalid_questions');
 const answers={};
 for(const q of questions){const ids=input.answers[q.questionId];if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||!answerIds(q,ids).length)throw Error('invalid_answers');answers[q.questionId]=answerIds(q,ids);}
 if(!exact(input.scores,KEYS)||KEYS.some(k=>!Number.isInteger(input.scores[k])||input.scores[k]<0))throw Error('invalid_scores');
 const result=calculate(questions,answers),resultTypes=result.status==='exploring'?['EXPLORING']:result.candidates.map(c=>c.key);
 if(!Array.isArray(input.result_type)||input.result_type.length!==resultTypes.length||new Set(input.result_type).size!==input.result_type.length||resultTypes.some(k=>!input.result_type.includes(k)))throw Error('result_mismatch');
 if(KEYS.some(k=>input.scores[k]!==result.totals[k]))throw Error('score_mismatch');
 // Receipt time is server-owned. Client time is validated but never trusted/stored.
 return {submission_id:input.submission_id,submitted_at:now.toISOString(),answers,result_type:resultTypes,scores:result.totals};
}
