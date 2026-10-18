import {answerIds,validSelections,complete} from './answers.js';
export const KEYS=['ACT','RESET','SOCIAL','LUCKY','THINK','SAVE'];
export const CONFIG={version:'pilot-1.3',calibrated:false,minEvidence:2,nearTieGap:0.1,epsilon:1e-9};
const score=(o,k)=>o.scoringEnabled&&Number.isFinite(o.scores[k])?o.scores[k]:0;
export function theoretical(questions){
 return Object.fromEntries(KEYS.map(k=>[k,{max:questions.filter(q=>q.scoringEnabled).reduce((s,q)=>s+Math.max(0,...validSelections(q).map(ids=>q.options.filter(o=>ids.includes(o.optionId)).reduce((n,o)=>n+score(o,k),0))),0),questions:questions.filter(q=>q.scoringEnabled&&q.options.some(o=>typeof o.scores[k]==='number'&&o.scores[k]>0)).length}]));
}
export function calculate(questions,answers,config=CONFIG){
 const totals=Object.fromEntries(KEYS.map(k=>[k,0]));
 const evidence=Object.fromEntries(KEYS.map(k=>[k,0]));
 const behavioralProfile={};const rawBehavioralProfile={};const contextProfile=[];const selections=[];
 for(const q of questions){const ids=answerIds(q,answers[q.questionId]);const selected=q.options.filter(o=>ids.includes(o.optionId));
 for(const o of selected){selections.push(o);
 if(o.behaviorTag)rawBehavioralProfile[o.behaviorTag]=(rawBehavioralProfile[o.behaviorTag]||0)+1;
 const tag=o.feedbackTag||o.behaviorTag;if(tag)behavioralProfile[tag]=(behavioralProfile[tag]||0)+1;
 if(/背景|状态|情境|需求/.test(o.answerNature||''))contextProfile.push(o);
 if(q.scoringEnabled)for(const k of KEYS)totals[k]+=score(o,k);
 }
 if(q.scoringEnabled)for(const k of KEYS)if(selected.some(o=>score(o,k)>0))evidence[k]++;
 }
 const theory=theoretical(questions);
 const ranking=KEYS.map(key=>({key,raw:totals[key],evidence:evidence[key],normalized:theory[key].max?totals[key]/theory[key].max:0})).filter(x=>x.evidence>=config.minEvidence&&x.raw>0).sort((a,b)=>b.normalized-a.normalized);
 const top=ranking[0];
 const tied=top?ranking.filter(x=>Math.abs(x.normalized-top.normalized)<=config.epsilon):[];
 const candidates=tied.length>1?tied:top?ranking.filter(x=>top.normalized-x.normalized<=config.nearTieGap+config.epsilon):[];
 const completed=complete(questions,answers);
 const status=!top?(completed?'exploring':'insufficient'):tied.length>1?'tie':candidates.length>1?'mixed':'single';
 const reason=!top?(Object.values(totals).every(v=>v===0)?'all-zero':'low-evidence'):status;
 return {completed,totals,evidence,theory,ranking,candidates,status,reason,primary:status==='single'?top.key:null,behavioralProfile,rawBehavioralProfile,contextProfile,selections,config};
}
