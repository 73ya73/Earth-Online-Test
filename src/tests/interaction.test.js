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
 const w=dom.window;w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:(_,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):key==='measureText'?text=>({width:text.length*30}):()=>{},set:()=>true});
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
test('XP window controls and desktop restoration preserve selected answer',async()=>{
 const dom=await setup();const d=dom.window.document;await click(dom,button(dom,'Start Setup'));await click(dom,d.querySelector('input[value="C"]'));
 await click(dom,d.querySelector('[aria-label="最小化窗口"]'));assert.equal(d.querySelector('.xp-window').hidden,true);await click(dom,d.querySelector('.task-button'));assert.equal(d.querySelector('.xp-window').hidden,false);assert.equal(d.querySelector('input:checked').value,'C');
 await click(dom,d.querySelector('[aria-label="最大化窗口"]'));assert.ok(d.querySelector('.maximized'));await click(dom,d.querySelector('[aria-label="还原窗口"]'));assert.equal(d.querySelector('.maximized'),null);
 await click(dom,d.querySelector('[aria-label="关闭窗口并保留进度"]'));assert.equal(d.querySelector('.xp-window').hidden,true);await click(dom,d.querySelector('.desktop-icons button'));assert.equal(d.querySelector('input:checked').value,'C');
 await click(dom,d.querySelector('.start-button'));assert.ok(d.querySelector('.start-menu'));await click(dom,d.querySelector('.start-menu button'));assert.equal(d.querySelector('.start-menu'),null);
 await click(dom,button(dom,'使用说明'));assert.ok(d.querySelector('[role="dialog"]'));d.defaultView.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'}));await wait(20);assert.equal(d.querySelector('[role="dialog"]'),null);dom.window.close();
});
test('XP result still supports PNG download, native sharing, copy link and score details',async()=>{
 const answers=Object.fromEntries(['A','A','A','D','D','D','B','A','E','A','D','A'].map((a,i)=>[`Q${i+1}`,a]));const dom=await setup(JSON.stringify({version:1,answers,index:11,page:'result'}));const w=dom.window,d=w.document;
 await click(dom,button(dom,'继续上次'));let downloaded=null,copied='',shared=null;Object.defineProperty(d,'fonts',{value:{ready:Promise.resolve()}});w.HTMLCanvasElement.prototype.toBlob=function(callback){assert.equal(this.width,1080);assert.equal(this.height,1440);callback(new w.Blob(['png'],{type:'image/png'}));};w.URL.createObjectURL=()=> 'blob:result';w.URL.revokeObjectURL=()=>{};const anchorClick=w.HTMLAnchorElement.prototype.click;w.HTMLAnchorElement.prototype.click=function(){if(this.download)downloaded=this.download;else anchorClick.call(this);};Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});
 await click(dom,button(dom,'保存结果图片'));assert.equal(downloaded,'地球Online-回血人格.png');await click(dom,button(dom,'分享 / 复制链接'));assert.equal(copied,'http://localhost/');w.navigator.share=async data=>{shared=data;};await click(dom,button(dom,'分享 / 复制链接'));assert.equal(shared.url,'http://localhost/');assert.equal(JSON.stringify(shared).includes('Q4'),false);
 await click(dom,[...d.querySelectorAll('.profile-tabs a')].find(a=>a.textContent==='计分说明'));assert.equal(d.querySelector('#profile-rules').open,true);assert.equal(d.querySelectorAll('.score-table>div').length,6);dom.window.close();
});
