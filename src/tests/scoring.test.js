import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate,theoretical,KEYS} from '../scoring/engine.js';
const qs=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url),'utf8'));
test('12 questions / 64 exact options / six mechanisms',()=>{assert.equal(qs.length,12);assert.equal(qs.flatMap(q=>q.options).length,64);assert.deepEqual(qs.map(q=>q.options.length),[4,7,4,5,5,5,4,5,7,6,5,7]);assert.equal(KEYS.includes('PLAY'),false);for(const q of qs)for(const o of q.options){assert.equal(o.questionId,q.questionId);assert.equal(o.answerNature,q.answerNature);assert.deepEqual(Object.keys(o.scores),KEYS);}});
test('theoretical score maxima',()=>assert.deepEqual(Object.fromEntries(Object.entries(theoretical(qs)).map(([k,v])=>[k,v.max])),{ACT:5,RESET:6,SOCIAL:8,LUCKY:8,THINK:6,SAVE:5}));
test('undefined scores remain null and add nothing',()=>{const r=calculate(qs,{Q6:'A',Q7:'B',Q8:'E',Q9:'B',Q11:'D'});assert.ok(Object.values(r.totals).every(x=>x===0));assert.equal(r.status,'insufficient');assert.equal(r.behavioralProfile['T08 反复确认'],1);assert.equal(qs[5].options[0].scores.ACT,null);});
test('zero scores never receive inferred points',()=>{const copy=structuredClone(qs);copy[5].options[0].scores=Object.fromEntries(KEYS.map(k=>[k,0]));const r=calculate(copy,{Q6:'A'});assert.ok(Object.values(r.totals).every(x=>x===0));});
test('disabled options preserve tags and context without scoring',()=>{const r=calculate(qs,{Q5:'D',Q10:'C',Q12:'A'});assert.ok(Object.values(r.totals).every(x=>x===0));assert.equal(r.behavioralProfile['T04 象征仪式'],1);assert.equal(r.contextProfile.length,3);});
test('Q9 D explicitly scores THINK despite RESET behavior tag',()=>{const r=calculate(qs,{Q9:'D'});assert.equal(r.totals.THINK,2);assert.equal(r.totals.RESET,0);assert.equal(r.behavioralProfile['T02 暂停休整'],1);});
test('tags cannot change the ranking',()=>{const answers={Q4:'D',Q6:'D',Q8:'A',Q9:'E'};const copy=structuredClone(qs);copy.forEach(q=>q.options.forEach(o=>o.behaviorTag='T01 主动应对'));assert.deepEqual(calculate(copy,answers).totals,calculate(qs,answers).totals);assert.equal(calculate(copy,answers).primary,'LUCKY');});
test('modifying an answer recalculates without accumulation',()=>{assert.equal(calculate(qs,{Q4:'A'}).totals.ACT,2);const r=calculate(qs,{Q4:'B'});assert.equal(r.totals.ACT,0);assert.equal(r.totals.RESET,2);});
test('single positive question does not force a personality',()=>assert.equal(calculate(qs,{Q4:'D'}).status,'insufficient'));
test('tie is reproducible and never selects arbitrary primary',()=>{const r=calculate(qs,{Q4:'A',Q7:'C',Q8:'D',Q11:'B'});assert.equal(r.status,'tie');assert.equal(r.primary,null);assert.deepEqual(new Set(r.candidates.map(x=>x.key)),new Set(['ACT','SAVE']));});
test('near ties expose a mixed result',()=>{const custom=[{questionId:'X',scoringEnabled:true,options:[{optionId:'A',scoringEnabled:true,scores:{ACT:10,RESET:9,SOCIAL:0,LUCKY:0,THINK:0,SAVE:0}},{optionId:'B',scoringEnabled:true,scores:{ACT:0,RESET:10,SOCIAL:0,LUCKY:0,THINK:0,SAVE:0}}]}];assert.equal(calculate(custom,{X:'A'},{minEvidence:1,nearTieGap:.1,epsilon:1e-9}).status,'mixed');});
test('all six mechanisms have a unique candidate path',()=>{for(const k of KEYS){const answers={};for(const q of qs){const o=[...q.options].sort((a,b)=>(b.scores[k]||0)-(a.scores[k]||0))[0];answers[q.questionId]=o.optionId;}assert.equal(calculate(qs,answers).primary,k);}});
test('clear answers resets all scoring',()=>{assert.equal(calculate(qs,{}).status,'insufficient');assert.equal(calculate(qs,{}).selections.length,0);});
test('every F–K numeric mapping matches the new Excel, including deliberate zero-evidence options',()=>{
 const expected={Q4:{A:{ACT:2},B:{RESET:2},C:{SOCIAL:2},D:{LUCKY:2},E:{THINK:2}},Q6:{A:{},B:{},C:{SOCIAL:2},D:{LUCKY:2},E:{THINK:2}},Q7:{A:{},B:{},C:{ACT:1},D:{RESET:1}},Q8:{A:{LUCKY:2},B:{LUCKY:2},C:{},D:{LUCKY:1,SAVE:1},E:{}},Q9:{A:{RESET:2},B:{},C:{SOCIAL:2},D:{THINK:2},E:{LUCKY:2},F:{ACT:2},G:{SAVE:2}},Q11:{A:{SOCIAL:2},B:{SAVE:2},C:{RESET:1},D:{},E:{}}};
 assert.deepEqual(qs.filter(q=>q.scoringEnabled).map(q=>q.questionId),Object.keys(expected));
 for(const [qid,options] of Object.entries(expected))for(const [id,scores] of Object.entries(options)){const o=qs.find(q=>q.questionId===qid).options.find(o=>o.optionId===id);assert.deepEqual(Object.fromEntries(Object.entries(o.scores).filter(([,v])=>typeof v==='number')),scores,`${qid}-${id}`);}
});
test('full zero score is unreachable with mandatory Q4; low evidence remains a distinct state',()=>{
 assert.ok(qs.find(q=>q.questionId==='Q4').options.every(o=>Object.values(o.scores).some(v=>typeof v==='number'&&v>0)));
 const answers=Object.fromEntries(qs.map(q=>[q.questionId,'A']));Object.assign(answers,{Q4:'A',Q6:'A',Q7:'A',Q8:'E',Q9:'B',Q11:'D'});
 const r=calculate(qs,answers);assert.equal(r.reason,'low-evidence');assert.equal(r.primary,null);assert.equal(r.totals.ACT,2);assert.equal(r.selections.length,12);assert.equal(calculate(qs,{}).reason,'all-zero');
});
test('exact ties exclude a lower near-tie candidate, without hidden ordering',()=>{
 const row=(optionId,scores)=>({optionId,scoringEnabled:true,scores});
 const data=[{questionId:'X',scoringEnabled:true,options:[row('A',{ACT:10,RESET:10,SOCIAL:9}),row('B',{SOCIAL:10})]}];
 const r=calculate(data,{X:'A'},{minEvidence:1,nearTieGap:.1,epsilon:1e-9});assert.equal(r.status,'tie');assert.equal(r.primary,null);assert.deepEqual(new Set(r.candidates.map(x=>x.key)),new Set(['ACT','RESET']));
});
