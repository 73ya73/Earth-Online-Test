import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const dist=new URL('../../dist/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',dist),'utf8');
const asset=html.match(/src="([^" ]+\.js)"/)[1].replace(/^\.\//,'');
const script=fs.readFileSync(new URL(asset,dist),'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(storage){
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>{},set:()=>true});
 if(storage)w.localStorage.setItem('earth-recharge-pilot-1',storage);
 w.eval(script);await wait(40);return dom;
}
function button(dom,text){const b=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert.ok(b,`button ${text} exists`);return b;}
async function click(dom,node){node.click();await wait(25);}
test('real rendered application: radio, navigation, persistence, scoring and reset',async()=>{
 const dom=await setup();const d=dom.window.document;
 await click(dom,button(dom,'开始测试'));assert.equal(d.querySelectorAll('input[type=radio]').length,4);assert.equal(button(dom,'下一题').disabled,true);
 await click(dom,d.querySelectorAll('input')[0]);await click(dom,d.querySelectorAll('input')[1]);assert.equal(d.querySelectorAll('input:checked').length,1);assert.equal(d.querySelector('input:checked').value,'B');
 await click(dom,button(dom,'下一题'));assert.equal(d.querySelectorAll('input').length,6);await click(dom,button(dom,'上一题'));assert.equal(d.querySelector('input:checked').value,'B');
 const storage=dom.window.localStorage.getItem('earth-recharge-pilot-1');const refresh=await setup(storage);await click(refresh,button(refresh,'继续上次'));assert.equal(refresh.window.document.querySelector('input:checked').value,'B');refresh.window.close();
 // LUCK pathway; actual UI choices go through every question.
 const choices=['A','A','A','D','D','D','B','A','E','A','D','A'];
 for(let i=0;i<12;i++){await click(dom,d.querySelector(`input[value="${choices[i]}"]`));await click(dom,button(dom,i===11?'查看我的回血人格':'下一题'));}
 assert.ok(d.body.textContent.includes('精神系统分析中'));await wait(800);assert.ok(d.querySelector('#page-title').textContent.includes('赛博锦鲤型'));assert.ok(d.body.textContent.includes('象征仪式'));
 const resultStorage=dom.window.localStorage.getItem('earth-recharge-pilot-1');const resultRefresh=await setup(resultStorage);await click(resultRefresh,button(resultRefresh,'继续上次'));assert.ok(resultRefresh.window.document.querySelector('#page-title').textContent.includes('赛博锦鲤型'));resultRefresh.window.close();
 await click(dom,button(dom,'重新测试'));assert.equal(dom.window.localStorage.getItem('earth-recharge-pilot-1'),null);await click(dom,button(dom,'开始测试'));assert.equal(d.querySelectorAll('input:checked').length,0);assert.equal(button(dom,'下一题').disabled,true);dom.window.close();
});
test('corrupt saved progress safely returns to welcome',async()=>{const dom=await setup('invalid');assert.ok(button(dom,'开始测试'));assert.equal([...dom.window.document.querySelectorAll('button')].some(b=>b.textContent.includes('继续上次')),false);dom.window.close();});
