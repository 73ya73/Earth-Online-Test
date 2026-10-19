import {answerIds,complete} from '../scoring/answers.js';
export const DATASET_VERSION='1.5';
export const STORAGE_KEY='earth-recharge-v1.5';
const PREVIOUS=[['earth-recharge-v1.3','1.3'],['earth-recharge-v1.2','1.2']];
export function restore(questions:any[]){try{
 const entry=[[STORAGE_KEY,DATASET_VERSION],...PREVIOUS].find(([key])=>localStorage.getItem(key)!==null);if(!entry)return null;
 const s=JSON.parse(localStorage.getItem(entry[0])!);if(!s||s.version!==entry[1]||!s.answers||typeof s.answers!=='object'||Array.isArray(s.answers))return null;
 const answers:Record<string,string[]>={};for(const q of questions){const saved=s.answers[q.questionId];if(Array.isArray(saved)&&answerIds(q,saved).length)answers[q.questionId]=answerIds(q,saved);}
 const done=complete(questions,answers),invalidIndex=questions.findIndex(q=>s.answers[q.questionId]&&!answerIds(q,s.answers[q.questionId]).length);
 return {answers,index:invalidIndex>=0?invalidIndex:Math.min(questions.length-1,Math.max(0,Number.isInteger(s.index)?s.index:0)),page:s.page==='result'&&done?'result':'quiz',researchSubmission:s.researchSubmission&&typeof s.researchSubmission==='object'&&!Array.isArray(s.researchSubmission)?s.researchSubmission:null,sessionId:typeof s.sessionId==='string'?s.sessionId:null,completedAt:typeof s.completedAt==='string'?s.completedAt:null};
 }catch{return null;}}
export function persist(answers:Record<string,string[]>,index:number,page:string,meta:any={}){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:DATASET_VERSION,answers,index,page,...meta}));}catch{}}
export function clearProgress(){try{for(const key of [STORAGE_KEY,...PREVIOUS.map(([key])=>key)])localStorage.removeItem(key);}catch{}}
