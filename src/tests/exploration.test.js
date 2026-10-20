import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import * as i18n from '../i18n/index.js';
import * as exploration from '../data/exploration.js';
import * as advice from '../data/exploration-advice.js';
const {explorationDirections:select,EXPLORATION_DIRECTIONS:directions}=exploration;
const source=fs.readFileSync(new URL('../components/ExplorationDirections.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const module={exports:{}};
vm.runInNewContext(compiled,{exports:module.exports,require:name=>({'react':React,'../i18n/index.js':i18n,'../data/exploration.js':exploration,'../data/exploration-advice.js':advice}[name])});
const render=totals=>renderToStaticMarkup(React.createElement(module.exports.ExplorationDirections,{totals}));

test('exploration uses only positive canonical raw scores, at most two, without mutating scores',()=>{
 const totals=Object.freeze({ACT:0,RESET:2,SOCIAL:-1,LUCKY:0,THINK:2,SAVE:0,behaviorTag:100});
 assert.deepEqual(select(totals),{items:['RESET','THINK'],tiedCount:0,available:true});
 assert.deepEqual(select({SAVE:1}),{items:['SAVE'],tiedCount:0,available:true});
 assert.deepEqual(select({THINK:4,RESET:2,SAVE:1}).items,['THINK','RESET']);
 assert.equal(totals.RESET,2);assert.equal(totals.THINK,2);
});

test('cutoff ties are summarized, never broken using fixed personality order',()=>{
 assert.deepEqual(select({ACT:2,RESET:2,THINK:2}),{items:[],tiedCount:3,available:true});
 assert.deepEqual(select({SAVE:3,ACT:2,RESET:2,THINK:2}),{items:['SAVE'],tiedCount:3,available:true});
 assert.deepEqual(select({ACT:2,RESET:2,THINK:1}).items,['ACT','RESET']);
 assert.equal(select(Object.fromEntries(Object.keys(directions).map(k=>[k,1]))).tiedCount,6);
});

test('zero or absent scores hide clues but retain an optional generic suggestion',()=>{
 for(const totals of [{},Object.fromEntries(Object.keys(directions).map(k=>[k,0]))]){
 const dom=new JSDOM(render(totals));assert.equal(dom.window.document.querySelector('.recharge-clues'),null);assert.ok(dom.window.document.querySelector('.exploration-try p').textContent.includes(i18n.t(advice.EXPLORATION_FALLBACK_ADVICE.body)));dom.window.close();
 }
 assert.equal(select({RESET:NaN,THINK:'2'}).available,false);
});

test('all six exploration directions and tie summaries render in both languages without score charts',()=>{
 try{
  for(const locale of ['zh','en']){
   i18n.setLocale(locale);
   for(const [key,texts] of Object.entries(directions)){
    const dom=new JSDOM(render({[key]:2})),text=dom.window.document.body.textContent;
    assert.equal(dom.window.document.querySelectorAll('li').length,1);
    for(const value of texts){assert.ok(text.includes(i18n.t(value)));if(locale==='en')assert.doesNotMatch(i18n.t(value),/[\u3400-\u9fff]/);}
    assert.equal(dom.window.document.querySelectorAll('meter,canvas,progress').length,0);assert.ok(!text.includes('%'));dom.window.close();
   }
   const html=render({ACT:2,RESET:2,THINK:2});
   const dom=new JSDOM(html);assert.equal(dom.window.document.querySelectorAll('li').length,0);
   assert.ok(dom.window.document.querySelector('.exploration-tie').textContent.includes('3'));
   if(locale==='en')assert.doesNotMatch(dom.window.document.body.textContent,/[\u3400-\u9fff]/);
   dom.window.close();
  }
 }finally{i18n.setLocale('zh');}
});

test('EXPLORING profile has the requested bilingual copy; directions are isolated from other results and historical snapshots',()=>{
 const profile=JSON.parse(fs.readFileSync(new URL('../data/exploring.json',import.meta.url)));
 assert.equal(profile.name,'回血机制探索中');assert.equal(profile.quote,'你的回答已经留下了一些回血线索。');
 assert.equal(profile.description,'目前还没有足够证据确定单一主导机制，但这些线索可以帮你选择一种轻松的尝试。');
 const translated=i18n.t(profile.quote,{},'en');assert.equal(translated,'Your answers offer a few recharge clues.');
 assert.equal(i18n.t(profile.description,{},'en'),"There isn't enough evidence for one main recharge mode yet, but these clues can help you choose a small thing to try.");
 const page=fs.readFileSync(new URL('../components/ResultProfile.tsx',import.meta.url),'utf8');
 assert.match(page,/exploring && !snapshot && <ExplorationDirections totals=\{result\.totals\}/);
});

test('RESET plus THINK gives two optional actions; a single direction never invents a second clue',()=>{
 try{
  for(const locale of ['zh','en']){
   i18n.setLocale(locale);
   const two=new JSDOM(render({RESET:2,THINK:2}));
   assert.equal(two.window.document.querySelectorAll('li').length,2);
   const selected=advice.explorationAdvice(['RESET','THINK']);
   assert.equal(two.window.document.querySelector('.exploration-try p').textContent,i18n.t(selected.body));
   assert.equal(two.window.document.querySelector('.exploration-try small').textContent,i18n.t(selected.observation));
   assert.ok(!two.window.document.querySelector('.recharge-clues').textContent.includes(i18n.t(selected.body)));
   assert.ok(!two.window.document.body.textContent.includes('%'));two.window.close();
   const one=new JSDOM(render({SAVE:2}));assert.equal(one.window.document.querySelectorAll('li').length,1);
   assert.equal(one.window.document.querySelector('.exploration-try p').textContent,i18n.t(advice.explorationAdvice(['SAVE']).body));one.window.close();
  }
 }finally{i18n.setLocale('zh');}
});

test('three or more tied directions use a generic action without silently selecting winners',()=>{
 try{
  for(const locale of ['zh','en']){
   i18n.setLocale(locale);const dom=new JSDOM(render({RESET:2,THINK:2,SOCIAL:2}));
   assert.equal(dom.window.document.querySelectorAll('li').length,0);
   assert.equal(dom.window.document.querySelector('.exploration-try p').textContent,i18n.t(advice.EXPLORATION_FALLBACK_ADVICE.body));
   assert.ok(dom.window.document.querySelector('.exploration-tie').textContent.includes('3'));dom.window.close();
  }
 }finally{i18n.setLocale('zh');}
});

test('all six single directions and fifteen pairs have complete bilingual actions and matching observations',()=>{
 const keys=Object.keys(directions),sets=keys.map(k=>[k]);
 for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++)sets.push([keys[i],keys[j]]);
 assert.equal(sets.length,21);assert.equal(Object.keys(advice.EXPLORATION_ADVICE).length,21);
 const bodies=new Set();
 try{
  for(const items of [...sets,[]]){
   const copy=[...items],selected=advice.explorationAdvice(items);
   assert.deepEqual(items,copy);assert.deepEqual(advice.explorationAdvice([...items].reverse()),selected);
   assert.ok(selected.body.length>10);assert.ok(selected.observation.startsWith('留意一下：'));
   if(items.length)bodies.add(selected.body);
   for(const locale of ['zh','en']){
    i18n.setLocale(locale);
    const dom=new JSDOM(render(Object.fromEntries(items.map(k=>[k,2]))));
    assert.equal(dom.window.document.querySelector('.exploration-try p').textContent,i18n.t(selected.body));
    assert.equal(dom.window.document.querySelector('.exploration-try small').textContent,i18n.t(selected.observation));
    if(locale==='en'){assert.doesNotMatch(i18n.t(selected.body),/[\u3400-\u9fff]/);assert.doesNotMatch(i18n.t(selected.observation),/[\u3400-\u9fff]/);}
    assert.doesNotMatch(dom.window.document.body.textContent,/可以只试一个|可以暂时不试|leave it for another time|Choose whichever feels easier|Or:/);
    dom.window.close();
   }
  }
  assert.equal(bodies.size,21,'pair advice is individually written, not a shared concatenation template');
 }finally{i18n.setLocale('zh');}
});

test('RESET and THINK use the requested practical example and a comparative observation',()=>{
 const selected=advice.explorationAdvice(['RESET','THINK']);
 assert.equal(selected.body,'下次感到精神疲惫时，试着给自己十分钟，不急着解决任何问题。如果脑海里还有事情放不下，可以写下最困扰你的一件事，以及现在能做的一小步。');
 assert.equal(selected.observation,'留意一下：是短暂休息，还是整理思路，让你感觉更轻松？');
 assert.equal(i18n.t(selected.observation,{},'en'),'Notice which helps you feel lighter: a short rest or getting your thoughts onto paper.');
});
