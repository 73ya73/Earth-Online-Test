import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {answerIds,toggleAnswer,complete,validSelections} from '../scoring/answers.js';
import {calculate,KEYS} from '../scoring/engine.js';
import {systemStatus} from '../scoring/status.js';
const qs=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url),'utf8'));
test('multi-select limits, toggling, dataset order, and Q13 exclusive G',()=>{
 const q9=qs[8],q13=qs[12];assert.deepEqual(answerIds(q9,['F','D']),['D','F']);
 assert.deepEqual(toggleAnswer(q9,['D','F'],'A'),{ids:['D','F'],limited:true});
 assert.deepEqual(toggleAnswer(q9,['D','F'],'D').ids,['F']);
 assert.deepEqual(toggleAnswer(q13,['A','C','F'],'G').ids,['G']);
 assert.deepEqual(toggleAnswer(q13,['G'],'B').ids,['B']);
 assert.equal(answerIds(q13,['A','B','C','D','E','F']).length,6);
 for(const [q,ids] of [[q9,['A','B','C']],[q9,['A','A']],[q9,['Z']],[q13,['A','G']],[qs[0],['A','B']]])assert.deepEqual(answerIds(q,ids),[]);
 assert.equal(validSelections(q9).length,28);assert.equal(validSelections(q13).length,64);
});
test('Q9 selected options sum exact Excel scores; evidence counts distinct questions',()=>{
 const r=calculate(qs,{Q9:['D','F']});assert.equal(r.totals.THINK,2);assert.equal(r.totals.ACT,2);assert.equal(r.totals.RESET,0);assert.equal(r.evidence.THINK,1);assert.equal(r.status,'insufficient');
 const copy=structuredClone(qs);copy[8].options[5].scores.THINK=3;
 const same=calculate(copy,{Q9:['D','F']});assert.equal(same.totals.THINK,5);assert.equal(same.evidence.THINK,1);
 assert.ok(Object.values(calculate(qs,{Q9:['D','F','A']}).totals).every(v=>v===0));
 const changed=calculate(qs,{Q9:['A','G']});assert.equal(changed.totals.THINK,0);assert.equal(changed.totals.ACT,0);assert.equal(changed.totals.RESET,2);assert.equal(changed.totals.SAVE,2);
});
test('Q10 E/F display feedback while retaining raw tags without scoring',()=>{
 const r=calculate(qs,{Q10:['E','F'],Q13:['A','C','F']});assert.ok(Object.values(r.totals).every(v=>v===0));assert.equal(r.rawBehavioralProfile['T08 反复确认'],1);assert.equal(r.rawBehavioralProfile['T10 寻求方向'],1);
 assert.equal(r.behavioralProfile['T08 反复确认'],undefined);assert.equal(r.behavioralProfile['T10 寻求方向'],undefined);assert.equal(r.behavioralProfile['效果反馈：状态无明显变化'],1);assert.equal(r.behavioralProfile['效果反馈：负面效果触发'],1);assert.equal(r.selections.length,5);
 assert.ok(qs[9].options.slice(4).every(o=>o.tagCalibration==='needs-review'));
});
test('System Status uses raw total shares, handles zero/nonfinite values, and retains cutoff ties',()=>{
 const s=systemStatus({ACT:4,RESET:2,SOCIAL:1,LUCKY:1,THINK:0,SAVE:0});assert.equal(s.attributes[0].percent,50);assert.equal(s.attributes[1].percent,25);assert.equal(s.attributes[2].percent,12.5);assert.equal(s.attributes.reduce((n,x)=>n+x.percent,0),100);assert.deepEqual(s.top.map(x=>x.rank),[1,2,3,3]);
 const tiny=systemStatus({ACT:.001});assert.equal(tiny.attributes[0].percent,100);
 for(const totals of [{},{ACT:NaN,RESET:Infinity,SAVE:-1},Object.fromEntries(KEYS.map(k=>[k,Number.MAX_VALUE]))]){const zero=systemStatus(totals);assert.equal(zero.available,false);assert.equal(zero.top.length,0);assert.ok(zero.attributes.every(x=>x.percent===0));}
 const r=calculate(qs,{Q4:['A'],Q9:['D','F']});const status=systemStatus(r.totals);assert.ok(Math.abs(status.attributes.reduce((n,x)=>n+x.percent,0)-100)<.31);assert.equal(r.primary,'ACT');assert.equal(r.ranking[0].normalized,.8);assert.equal(status.attributes[0].percent,66.7);
});
test('completion validates all 13 answers and refuses invalid multi sets',()=>{
 const answers=Object.fromEntries(qs.map(q=>[q.questionId,['A']]));assert.equal(complete(qs,answers),true);answers.Q13=['A','G'];assert.equal(complete(qs,answers),false);answers.Q13=['G'];delete answers.Q10;assert.equal(complete(qs,answers),false);
});
