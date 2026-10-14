export const KEYS=['ACT','RESET','SOCIAL','LUCK','THINK','SAVE'];
export const CONFIG={version:'pilot-1',calibrated:false,minEvidence:2,nearTieGap:0.1,epsilon:1e-9};
export function theoretical(questions){
 return Object.fromEntries(KEYS.map(k=>[k,{max:questions.filter(q=>q.scoringEnabled).reduce((s,q)=>s+Math.max(0,...q.options.map(o=>typeof o.scores[k]==='number'?o.scores[k]:0)),0),questions:questions.filter(q=>q.scoringEnabled&&q.options.some(o=>typeof o.scores[k]==='number'&&o.scores[k]>0)).length}]));
}
export function calculate(questions,answers,config=CONFIG){
 const totals=Object.fromEntries(KEYS.map(k=>[k,0]));
 const evidence=Object.fromEntries(KEYS.map(k=>[k,0]));
 const behavioralProfile={};const contextProfile=[];const selections=[];
 for(const q of questions){const o=q.options.find(o=>o.optionId===answers[q.questionId]);if(!o)continue;selections.push(o);
 if(o.behaviorTag)behavioralProfile[o.behaviorTag]=(behavioralProfile[o.behaviorTag]||0)+1;
 if(/背景|状态|情境|需求/.test(o.answerNature||''))contextProfile.push(o);
 if(o.scoringEnabled)for(const k of KEYS){const v=o.scores[k];if(typeof v==='number'){totals[k]+=v;if(v>0)evidence[k]++;}}
 }
 const theory=theoretical(questions);
 const ranking=KEYS.map(key=>({key,raw:totals[key],evidence:evidence[key],normalized:theory[key].max?totals[key]/theory[key].max:0})).filter(x=>x.evidence>=config.minEvidence&&x.raw>0).sort((a,b)=>b.normalized-a.normalized);
 const top=ranking[0];
 const tied=top?ranking.filter(x=>Math.abs(x.normalized-top.normalized)<=config.epsilon):[];
 const candidates=top?ranking.filter(x=>top.normalized-x.normalized<=config.nearTieGap+config.epsilon):[];
 const status=!top?'insufficient':tied.length>1?'tie':candidates.length>1?'mixed':'single';
 return {totals,evidence,theory,ranking,candidates,status,primary:status==='single'?top.key:null,behavioralProfile,contextProfile,selections,config};
}
