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
const {explorationDirections:select,EXPLORATION_DIRECTIONS:directions}=exploration;
const source=fs.readFileSync(new URL('../components/ExplorationDirections.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const module={exports:{}};
vm.runInNewContext(compiled,{exports:module.exports,require:name=>({'react':React,'../i18n/index.js':i18n,'../data/exploration.js':exploration}[name])});
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

test('zero or absent scores hide the entire exploration region',()=>{
 assert.equal(render({}), '');assert.equal(render(Object.fromEntries(Object.keys(directions).map(k=>[k,0]))),'');
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
 assert.equal(profile.name,'回血机制探索中');assert.equal(profile.quote,'你的精神系统还没有固定的回血配方。');
 assert.equal(profile.description,'本次检测发现了一些值得继续探索的方向，但目前还没有足够的线索确定一种主导回血机制。');
 const translated=i18n.t(profile.quote,{},'en');assert.equal(translated,'Your recharge style is still taking shape.');
 assert.equal(i18n.t(profile.description,{},'en'),"Your answers suggest a few possible directions to explore, but there isn't enough evidence yet to identify one main recharge style.");
 const page=fs.readFileSync(new URL('../components/ResultProfile.tsx',import.meta.url),'utf8');
 assert.match(page,/exploring && !snapshot && <ExplorationDirections totals=\{result\.totals\}/);
});
