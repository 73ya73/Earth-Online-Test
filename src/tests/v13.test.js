import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate,KEYS} from '../scoring/engine.js';
import {answerIds,toggleAnswer} from '../scoring/answers.js';
import {systemStatus} from '../scoring/status.js';
import {pixelArt} from '../data/pixel-art.js';
const qs=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url),'utf8'));
const base=Object.fromEntries(qs.map(q=>[q.questionId,['A']]));
const low={...base,Q4:['A'],Q6:['A'],Q7:['A'],Q8:['E'],Q9:['B'],Q12:['D']};
test('EXPLORING requires completion and no eligible candidate, without adding a score dimension',()=>{
 const partial=calculate(qs,{Q4:['A']});assert.equal(partial.status,'insufficient');assert.equal(partial.completed,false);
 const r=calculate(qs,low);assert.equal(r.status,'exploring');assert.equal(r.reason,'low-evidence');assert.equal(r.completed,true);assert.equal(r.primary,null);assert.deepEqual(r.candidates,[]);assert.deepEqual(Object.keys(r.totals),KEYS);assert.equal(r.totals.ACT,2);
 const noQ13={...low};delete noQ13.Q13;assert.equal(calculate(qs,noQ13).status,'insufficient');
 assert.deepEqual(calculate(qs,low),calculate(qs,structuredClone(low)));
});
test('zero, exact tie and near tie retain separate reasons',()=>{
 const zero=structuredClone(qs);zero.forEach(q=>q.options.forEach(o=>Object.keys(o.scores).forEach(k=>o.scores[k]=null)));
 const zr=calculate(zero,base);assert.equal(zr.status,'exploring');assert.equal(zr.reason,'all-zero');assert.ok(systemStatus(zr.totals).attributes.every(a=>a.percent===0));
 const tie=calculate(qs,{...base,Q4:['A'],Q6:['A'],Q7:['C'],Q8:['D'],Q9:['B'],Q12:['B']});assert.equal(tie.status,'tie');assert.equal(tie.completed,true);assert.deepEqual(new Set(tie.candidates.map(x=>x.key)),new Set(['ACT','SAVE']));
 const near=calculate([{questionId:'X',scoringEnabled:true,options:[{optionId:'A',scoringEnabled:true,scores:{ACT:10,RESET:9}},{optionId:'B',scoringEnabled:true,scores:{RESET:10}}]}],{X:['A']},{minEvidence:1,nearTieGap:.1,epsilon:1e-9});assert.equal(near.status,'mixed');assert.equal(near.completed,true);
});
test('one selected item scores, cancellation removes it, and changing does not accumulate',()=>{
 const q=qs[8];let ids=toggleAnswer(q,[],'D').ids;assert.deepEqual(ids,['D']);assert.equal(calculate(qs,{Q9:ids}).totals.THINK,2);
 ids=toggleAnswer(q,ids,'D').ids;assert.deepEqual(ids,[]);assert.equal(calculate(qs,{Q9:ids}).totals.THINK,0);
 ids=toggleAnswer(q,ids,'F').ids;const r=calculate(qs,{Q9:ids});assert.equal(r.totals.THINK,0);assert.equal(r.totals.ACT,2);assert.deepEqual(answerIds(q,['F','F']),[]);
});
test('new worksheet fixes labels and removes type instructions only from Q9/Q10 titles',()=>{
 for(const i of [8,9])assert.doesNotMatch(qs[i].text,/多选|最多/);
 assert.equal(qs[9].options[4].behaviorTag,'T13 无明显变化');assert.equal(qs[9].options[5].behaviorTag,'T14 负向体验');
 assert.equal(qs[8].options[3].scores.THINK,2);assert.equal(qs[8].options[5].scores.ACT,2);
});
test('exploration profile has complete support, books, and distinct bounded original artwork',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('../data/exploring.json',import.meta.url),'utf8'));assert.equal(p.name,'回血机制探索中');assert.ok(p.quote&&p.systemMessage&&p.rechargeTip&&p.artLabel);assert.equal(p.books.length,2);assert.deepEqual(p.books.map(b=>b.author),['Lori Gottlieb','Russ Harris']);assert.ok(p.books.every(b=>b.url.startsWith('https://')));
 const commands=pixelArt('EXPLORING');for(const [x,y,w,h] of commands)assert.ok([x,y,w,h].every(Number.isFinite)&&x>=0&&y>=0&&w>0&&h>0&&x+w<=64&&y+h<=64);
 for(const key of [...KEYS,'unknown'])assert.notDeepEqual(commands,pixelArt(key));
});
