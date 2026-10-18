// All persisted v1.2 answers are ordered option-id arrays. Invalid sets are rejected.
export function answerIds(q,answer){
 const ids=typeof answer==='string'?[answer]:answer;
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)return [];
 const max=q.maxSelections??1;
 if(ids.length>max||ids.some(id=>!q.options.some(o=>o.optionId===id)))return [];
 if(ids.length>1&&ids.some(id=>q.exclusiveOptions?.includes(id)))return [];
 return q.options.filter(o=>ids.includes(o.optionId)).map(o=>o.optionId);
}
export function toggleAnswer(q,answer,id){
 const ids=answerIds(q,answer);
 if(!q.options.some(o=>o.optionId===id))return {ids,limited:false};
 if(q.selectionMode!=='multiple')return {ids:[id],limited:false};
 if(ids.includes(id))return {ids:ids.filter(x=>x!==id),limited:false};
 if(q.exclusiveOptions?.includes(id))return {ids:[id],limited:false};
 const next=ids.filter(x=>!q.exclusiveOptions?.includes(x));
 if(next.length>=(q.maxSelections??1))return {ids,limited:true};
 return {ids:answerIds(q,[...next,id]),limited:false};
}
export function complete(questions,answers){return questions.every(q=>answerIds(q,answers[q.questionId]).length>0);}
export function validSelections(q){
 const sets=[];
 for(let mask=1;mask<2**q.options.length;mask++){
  const ids=q.options.filter((_,i)=>mask&(2**i)).map(o=>o.optionId);
  if(answerIds(q,ids).length)sets.push(ids);
 }
 return sets;
}
