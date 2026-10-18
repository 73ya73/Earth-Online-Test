import {answerIds,complete} from '../scoring/answers.js';
export const DATASET_VERSION='1.2';
export const STORAGE_KEY='earth-recharge-v1.2';
export function restore(questions:any[]){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!s||s.version!==DATASET_VERSION||!s.answers||typeof s.answers!=='object'||Array.isArray(s.answers))return null;const answers:Record<string,string[]>={};for(const q of questions){const saved=s.answers[q.questionId];if(Array.isArray(saved)&&answerIds(q,saved).length)answers[q.questionId]=answerIds(q,saved);}return {answers,index:Math.min(questions.length-1,Math.max(0,Number.isInteger(s.index)?s.index:0)),page:s.page==='result'&&complete(questions,answers)?'result':'quiz'};}catch{return null;}}
export function persist(answers:Record<string,string[]>,index:number,page:string){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:DATASET_VERSION,answers,index,page}));}catch{}}
