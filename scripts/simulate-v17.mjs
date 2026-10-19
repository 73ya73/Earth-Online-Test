import fs from 'node:fs';
import {validSelections} from '../src/scoring/answers.js';
import {calculate,KEYS,theoretical} from '../src/scoring/engine.js';
import {calculateV17} from '../src/scoring/v17.js';
import {V17_CONFIG} from '../src/scoring/v17-config.js';
const root=new URL('../',import.meta.url),qs=JSON.parse(fs.readFileSync(new URL('src/data/questions.json',root)));
let seed=20261019;const count=10000,choices=qs.map(validSelections);
const counts=Object.fromEntries([...KEYS,'EXPLORING','MULTI'].map(k=>[k,0]));let exactTie=0,threePlus=0,lowScore=0,lowEvidence=0,legacyMulti=0;
for(let i=0;i<count;i++){
 const answers=Object.fromEntries(qs.map((q,j)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return [q.questionId,choices[j][Math.floor(seed/2**32*choices[j].length)]];}));
 const old=calculate(qs,answers),r=calculateV17(qs,answers),high=Math.max(...Object.values(r.totals));counts[r.finalType]++;
 if(KEYS.filter(k=>r.totals[k]===high).length>1)exactTie++;
 if(r.finalType==='MULTI'&&r.candidates.length>=3)threePlus++;
 if(high<V17_CONFIG.minRaw)lowScore++;
 if(!KEYS.some(k=>r.evidence[k]>=V17_CONFIG.minEvidence))lowEvidence++;
 if(old.candidates.length>1)legacyMulti++;
}
const report={seed:20261019,count,config:V17_CONFIG,counts,percent:Object.fromEntries(Object.entries(counts).map(([k,n])=>[k,n/100])),exactTie,threePlus,lowScore,lowEvidence,legacyMulti,theory:theoretical(qs),warning:'Uniform legal selections, not population prevalence. Raw-score thresholds favor mechanisms with more scoring opportunities; weights unchanged. Pending approval; not active in production.'};
fs.writeFileSync(new URL('reports/v1.7-proposed-simulation.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
