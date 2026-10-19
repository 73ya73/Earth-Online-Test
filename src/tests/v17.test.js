import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateV17} from '../scoring/v17.js';
import {V17_CONFIG} from '../scoring/v17-config.js';
import {calculate,KEYS} from '../scoring/engine.js';
import {getLocale,setLocale,t,localizeQuestions} from '../i18n/index.js';
import {createV17Submission} from '../utils/research-v17.js';
import {validateV17Submission} from '../../supabase/functions/_shared/research-v17.js';
import {validateSubmission} from '../../supabase/functions/_shared/research.js';
import {createResearchQueue} from '../utils/researchQueue.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const questions=read('../data/questions.json'),fixtures=read('../../reports/v1.7-fixtures.json');
const enQuestions=read('../i18n/en-questions.json'),audit=read('../../reports/v1.7-input-audit.json');

test('official 13 questions/70 options are complete; locale changes only display fields',()=>{
 assert.equal(audit.questionCount,13);assert.equal(audit.optionCount,70);assert.deepEqual(audit.missing,[]);assert.deepEqual(audit.metadataDifferences,[]);
 const en=localizeQuestions(questions,'en');
 for(let i=0;i<questions.length;i++){
  const q=questions[i],translated=en[i];assert.equal(translated.text,enQuestions[q.questionId].text);
  assert.deepEqual({...translated,text:q.text,options:translated.options.map((o,j)=>({...o,text:q.options[j].text}))},q);
  for(const option of translated.options)assert.equal(option.text,enQuestions[q.questionId].options[option.optionId]);
 }
 assert.equal(questions[10].text,'Q11 如果『等待进度』可以转化成可视化道具，你会如何使用它？');
});

test('candidate eight results exist and are locale-independent, with original raw scores',()=>{
 for(const type of [...KEYS,'MULTI','EXPLORING']){
  const answers=fixtures[type],zh=calculateV17(questions,answers),en=calculateV17(localizeQuestions(questions,'en'),answers);
  assert.equal(zh.finalType,type);assert.equal(en.finalType,type);assert.deepEqual(zh.totals,en.totals);assert.deepEqual(zh.evidence,en.evidence);
  assert.deepEqual(zh.totals,calculate(questions,answers).totals);assert.deepEqual(zh.evidence,calculate(questions,answers).evidence);
 }
});

test('MULTI requires independent support; three-plus ties are retained without fixed-order winner',()=>{
 const r=calculateV17(questions,fixtures.threePlus);assert.equal(r.finalType,'MULTI');assert.ok(r.candidates.length>=3);
 for(const c of r.candidates){assert.ok(c.evidence>=2);assert.ok(Math.max(...Object.values(r.totals))-c.raw<=1);}
 const reversed=calculateV17([...questions].reverse(),fixtures.threePlus);assert.equal(reversed.finalType,r.finalType);assert.deepEqual(new Set(reversed.candidates.map(c=>c.key)),new Set(r.candidates.map(c=>c.key)));
});

test('low score, single-question evidence and zero scores remain EXPLORING; incomplete stays insufficient',()=>{
 const answers=Object.fromEntries(questions.map(q=>[q.questionId,['A']]));
 const zero=questions.map(q=>({...q,scoringEnabled:false}));assert.equal(calculateV17(zero,answers).finalType,'EXPLORING');
 const one=questions.map(q=>({...q,scoringEnabled:q.questionId==='Q4'}));assert.equal(calculateV17(one,answers).finalType,'EXPLORING');
 assert.equal(calculateV17(questions,{}).status,'insufficient');assert.equal(calculateV17(questions,{}).finalType,null);
 const changed={...V17_CONFIG,minRaw:100};assert.equal(calculateV17(questions,fixtures.ACT,changed).finalType,'EXPLORING');
});

test('50/50 shares with two raw points and one evidence question each remain EXPLORING',()=>{
 const answers=Object.fromEntries(questions.map(q=>[q.questionId,['A']]));
 Object.assign(answers,{Q4:['B'],Q6:['E'],Q8:['E'],Q9:['B'],Q12:['D']});
 for(const locale of ['zh','en']){
  const r=calculateV17(localizeQuestions(questions,locale),answers);
  assert.equal(r.completed,true);assert.deepEqual(r.totals,{ACT:0,RESET:2,SOCIAL:0,LUCKY:0,THINK:2,SAVE:0});
  assert.equal(r.evidence.RESET,1);assert.equal(r.evidence.THINK,1);
  assert.equal(r.finalType,'EXPLORING');assert.equal(r.reason,'low-score');assert.equal(r.algorithm_version,'pilot-1.7-raw-v1');
 }
});

test('MULTI includes supported mechanisms at a one-point gap, excluding insufficient evidence',()=>{
 const answers=Object.fromEntries(questions.map(q=>[q.questionId,['A']]));
 Object.assign(answers,{Q4:['B'],Q6:['E'],Q7:['D'],Q8:['E'],Q9:['D'],Q12:['D']});
 const r=calculateV17(questions,answers);assert.equal(r.totals.RESET,3);assert.equal(r.totals.THINK,4);
 assert.equal(r.evidence.RESET,2);assert.equal(r.evidence.THINK,2);assert.equal(r.finalType,'MULTI');
 assert.deepEqual(new Set(r.candidates.map(c=>c.key)),new Set(['RESET','THINK']));
 assert.equal(calculateV17(questions,answers,{...V17_CONFIG,multiGap:0}).finalType,'THINK');
 const oneThink=calculateV17(questions,{...answers,Q9:['B']});
 assert.equal(oneThink.totals.THINK,2);assert.equal(oneThink.evidence.THINK,1);assert.equal(oneThink.finalType,'RESET');
});

test('V17 submission stores final result separately from canonical candidates and validates server recomputation',()=>{
 for(const key of [...KEYS,'MULTI','EXPLORING'])for(const locale of ['zh','en']){
  const p=createV17Submission(localizeQuestions(questions,locale),fixtures[key],locale),r=validateV17Submission(p);
  assert.deepEqual(p.result_type,[key]);assert.equal(p.algorithm_version,V17_CONFIG.version);assert.equal(p.locale,locale);
  assert.deepEqual(r.result_type,p.result_type);assert.deepEqual(r.candidate_types,p.candidate_types);assert.deepEqual(r.scores,p.scores);
  assert.throws(()=>validateSubmission(p));
 }
 const p=createV17Submission(questions,fixtures.MULTI);
 for(const mutate of [x=>x.result_type=['ACT'],x=>x.candidate_types=[],x=>x.scores.ACT++,x=>x.locale='xx',x=>x.algorithm_version='old',x=>delete x.answers.Q13]){const copy=structuredClone(p);mutate(copy);assert.throws(()=>validateV17Submission(copy));}
});

test('new-version records wait without consuming attempts until versioned endpoint configured',async()=>{
 const map=new Map(),storage={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const p=createV17Submission(questions,fixtures.MULTI,'en');let endpoint='',calls=0;
 const queue=createResearchQueue({endpoint:'https://legacy.invalid',storage,endpointFor:record=>record.algorithm_version?endpoint:'https://legacy.invalid',fetcher:async(url,options)=>{calls++;assert.equal(url,endpoint);assert.equal(JSON.parse(options.body).submission_id,p.submission_id);return new Response(JSON.stringify({ok:true,submission_id:p.submission_id,status:'already_saved'}));}});
 queue.enqueue(p);await queue.flush();assert.equal(calls,0);assert.equal(queue.inspect()[0].attempts,0);
 endpoint='https://v17.invalid';await queue.flush();assert.equal(calls,1);assert.equal(queue.inspect().length,0);
});

test('localized UI and persona strings are centralized, with no missing static t keys',()=>{
 const catalog=read('../i18n/en-ui.json');
 setLocale('en');assert.equal(getLocale(),'en');assert.equal(t('测测你的精神回血机制'),"What's Your Mental Recharge Mode?");
 const sources=[new URL('../main.tsx',import.meta.url),...fs.readdirSync(new URL('../components/',import.meta.url)).filter(n=>n.endsWith('.tsx')&&n!=='ResearchDebugPanel.tsx').map(n=>new URL('../components/'+n,import.meta.url))];
 for(const file of sources){const source=fs.readFileSync(file,'utf8');for(const match of source.matchAll(/\bt\(["']([^"'\n]+)["']/g))if(/[\u3400-\u9fff]/.test(match[1]))assert.ok(catalog[match[1]],match[1]);}
 const profiles={...read('../data/personas.json'),EXPLORING:read('../data/exploring.json')};
 for(const p of Object.values(profiles))for(const value of [p.name,p.quote,p.description,p.systemMessage,p.rechargeTip,p.artLabel,...p.ways,...p.books.map(b=>b.reason)])assert.ok(!/[\u3400-\u9fff]/.test(t(value)),value);
 setLocale('zh');
});
