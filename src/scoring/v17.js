import {calculate,KEYS} from './engine.js';
import {V17_CONFIG} from './v17-config.js';
export function calculateV17(questions,answers,config=V17_CONFIG){
 const base=calculate(questions,answers);
 const ranking=KEYS.map(key=>({key,raw:base.totals[key],evidence:base.evidence[key],normalized:base.theory[key].max?base.totals[key]/base.theory[key].max:0})).sort((a,b)=>b.raw-a.raw);
 const high=ranking[0].raw;
 // Include every sufficiently supported mechanism in the leading raw-score band.
 // This treats 3+ ties as sets, without choosing a winner by array order.
 const supported=ranking.filter(r=>r.raw>0&&r.evidence>=config.minEvidence&&high-r.raw<=config.multiGap);
 const topSupported=ranking.some(r=>r.raw===high&&r.evidence>=config.minEvidence);
 const exploring=high<config.minRaw||!topSupported;
 const candidates=base.completed&&!exploring?supported:[];
 const finalType=!base.completed?null:exploring?'EXPLORING':candidates.length>=2?'MULTI':candidates[0].key;
 return {...base,ranking,candidates,config,algorithm_version:config.version,finalType,
  primary:finalType&&KEYS.includes(finalType)?finalType:null,
  status:!base.completed?'insufficient':finalType==='MULTI'?'multi':finalType==='EXPLORING'?'exploring':'single',
  reason:!base.completed?'incomplete':exploring?(high===0?'all-zero':high<config.minRaw?'low-score':'low-evidence'):finalType==='MULTI'?'supported-near-tie':'single'};
}
