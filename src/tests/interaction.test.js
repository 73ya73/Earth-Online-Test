import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {calculate} from '../scoring/engine.js';
import {createArchive,ARCHIVE_KEY} from '../utils/archives.js';
const DATA_VERSION='1.5';
const questions=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url),'utf8'));
const personas=JSON.parse(fs.readFileSync(new URL('../data/personas.json',import.meta.url),'utf8'));
const dist=new URL('../../dist/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',dist),'utf8');
const asset=html.match(/src="([^" ]+\.js)"/)[1];
// The build may use a Pages repository prefix; the local bundle still lives in dist/assets.
const script=fs.readFileSync(new URL(`assets/${asset.split('/').pop()}`,dist),'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(storage,legacy=false,storageKey,extra={}){
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:(_,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):key==='measureText'?text=>({width:text.length*30}):()=>{},set:()=>true});
 if(storage){try{const saved=JSON.parse(storage);if(saved.version===DATA_VERSION)for(const key of Object.keys(saved.answers))if(typeof saved.answers[key]==='string')saved.answers[key]=[saved.answers[key]];storage=JSON.stringify(saved);}catch{}}
 if(storage)w.localStorage.setItem(storageKey||(legacy?'earth-recharge-pilot-1':'earth-recharge-v1.5'),storage);
 for(const [key,value] of Object.entries(extra))w.localStorage.setItem(key,value);
 w.eval(script);await wait(40);return dom;
}
function button(dom,text){const b=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert.ok(b,`button ${text} exists`);return b;}
async function click(dom,node){node.click();await wait(25);}
async function mouse(dom,node,detail=1){node.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,detail}));await wait(25);}
async function double(dom,node){node.dispatchEvent(new dom.window.MouseEvent('dblclick',{bubbles:true,detail:2}));await wait(25);}
const completeAnswers=()=>Object.fromEntries(questions.map(q=>[q.questionId,[[...q.options].sort((a,b)=>(b.scores.LUCKY||0)-(a.scores.LUCKY||0))[0].optionId]]));
function archiveFixture(session='fixture'){
 const answers=completeAnswers(),result=calculate(questions,answers),p=personas.LUCKY;
 return createArchive({sessionId:session,createdAt:'2026-10-18T14:30:00.000Z',answers,questions,result,profiles:personas,display:{types:['LUCKY'],profile:p,title:p.name,quote:p.quote,art:'LUCKY'}});
}
test('real rendered application: radio, navigation, persistence, scoring and reset',async()=>{
 const dom=await setup();const d=dom.window.document;
 await click(dom,button(dom,'开始测试'));assert.equal(d.querySelectorAll('input[type=radio]').length,4);assert.equal(button(dom,'下一题').disabled,true);
 await click(dom,d.querySelectorAll('input')[0]);await click(dom,d.querySelectorAll('input')[1]);assert.equal(d.querySelectorAll('input:checked').length,1);assert.equal(d.querySelector('input:checked').value,'B');
 await click(dom,button(dom,'下一题'));assert.equal(d.querySelectorAll('input').length,7);await click(dom,button(dom,'上一题'));assert.equal(d.querySelector('input:checked').value,'B');
 const storage=dom.window.localStorage.getItem('earth-recharge-v1.5');const refresh=await setup(storage);await click(refresh,button(refresh,'继续上次'));assert.equal(refresh.window.document.querySelector('input:checked').value,'B');refresh.window.close();
 // LUCK pathway; actual UI choices go through every question.
 const choices=['A','A','A','D','D','D','B','A','E','A','A','D','A'];
 for(let i=0;i<13;i++){assert.equal(d.querySelectorAll('input').length,questions[i].options.length);if(i===5)assert.equal(d.body.textContent.includes('RESULT LOADING'),false);await click(dom,d.querySelector(`input[value="${choices[i]}"]`));await click(dom,button(dom,i===12?'查看我的回血人格':'下一题'));}
 assert.ok(d.body.textContent.includes('精神系统分析中'));await wait(800);assert.ok(d.querySelector('#page-title').textContent.includes('赛博锦鲤型'));assert.ok(d.body.textContent.includes('象征仪式'));
 const resultStorage=dom.window.localStorage.getItem('earth-recharge-v1.5');const resultRefresh=await setup(resultStorage);await click(resultRefresh,button(resultRefresh,'继续上次'));assert.ok(resultRefresh.window.document.querySelector('#page-title').textContent.includes('赛博锦鲤型'));resultRefresh.window.close();
 await click(dom,button(dom,'重新测试'));assert.equal(dom.window.localStorage.getItem('earth-recharge-v1.5'),null);await click(dom,button(dom,'开始测试'));assert.equal(d.querySelectorAll('input:checked').length,0);assert.equal(button(dom,'下一题').disabled,true);dom.window.close();
});
test('corrupt saved progress safely returns to welcome',async()=>{const dom=await setup('invalid');assert.ok(button(dom,'开始测试'));assert.equal([...dom.window.document.querySelectorAll('button')].some(b=>b.textContent.includes('继续上次')),false);dom.window.close();});

test('rendered multi-select enforces caps, restores arrays, and clears exclusive options',async()=>{
 const dom=await setup(JSON.stringify({version:DATA_VERSION,answers:{Q9:['D']},index:8,page:'quiz'}));const d=dom.window.document;
 await click(dom,button(dom,'继续上次'));await click(dom,d.querySelector('input[value="F"]'));await click(dom,d.querySelector('input[value="A"]'));
 assert.deepEqual([...d.querySelectorAll('input:checked')].map(x=>x.value),['D','F']);assert.match(d.querySelector('[role=status]').textContent,/最多选择 2/);
 await click(dom,button(dom,'下一题'));await click(dom,d.querySelector('input[value="E"]'));await click(dom,d.querySelector('input[value="F"]'));await click(dom,d.querySelector('input[value="A"]'));assert.deepEqual([...d.querySelectorAll('input:checked')].map(x=>x.value),['A']);
 await click(dom,button(dom,'上一题'));assert.deepEqual([...d.querySelectorAll('input:checked')].map(x=>x.value),['D','F']);await click(dom,d.querySelector('input[value="D"]'));await click(dom,d.querySelector('input[value="A"]'));
 const saved=dom.window.localStorage.getItem('earth-recharge-v1.5');assert.deepEqual(JSON.parse(saved).answers.Q9,['A','F']);const reloaded=await setup(saved);await click(reloaded,button(reloaded,'继续上次'));assert.deepEqual([...reloaded.window.document.querySelectorAll('input:checked')].map(x=>x.value),['A','F']);reloaded.window.close();
 await click(dom,button(dom,'下一题'));await click(dom,button(dom,'下一题'));await click(dom,d.querySelector('input[value="A"]'));await click(dom,button(dom,'下一题'));await click(dom,d.querySelector('input[value="A"]'));await click(dom,button(dom,'下一题'));
 for(const id of ['A','B','C','D','E','F'])await click(dom,d.querySelector(`input[value="${id}"]`));assert.equal(d.querySelectorAll('input:checked').length,6);
 await click(dom,d.querySelector('input[value="G"]'));assert.deepEqual([...d.querySelectorAll('input:checked')].map(x=>x.value),['G']);await click(dom,d.querySelector('input[value="B"]'));assert.deepEqual([...d.querySelectorAll('input:checked')].map(x=>x.value),['B']);dom.window.close();
});

test('invalid persisted multi-answer cannot restore a completed result',async()=>{
 const answers=Object.fromEntries(questions.map(q=>[q.questionId,['A']]));answers.Q13=['A','G'];
 const dom=await setup(JSON.stringify({version:DATA_VERSION,answers,index:12,page:'result'}));await click(dom,button(dom,'继续上次'));assert.equal(dom.window.document.querySelectorAll('input:checked').length,0);assert.equal(button(dom,'查看我的回血人格').disabled,true);dom.window.close();
});
test('XP window controls and desktop restoration preserve selected answer',async()=>{
 const dom=await setup();const d=dom.window.document;await click(dom,button(dom,'Start Setup'));await click(dom,d.querySelector('input[value="C"]'));
 await click(dom,d.querySelector('[aria-label="最小化窗口"]'));assert.equal(d.querySelector('.xp-window').hidden,true);await click(dom,d.querySelector('.task-button'));assert.equal(d.querySelector('.xp-window').hidden,false);assert.equal(d.querySelector('input:checked').value,'C');
 await click(dom,d.querySelector('[aria-label="最大化窗口"]'));assert.ok(d.querySelector('.maximized'));await click(dom,d.querySelector('[aria-label="还原窗口"]'));assert.equal(d.querySelector('.maximized'),null);
 await click(dom,d.querySelector('[aria-label="关闭窗口并保留进度"]'));assert.equal(d.querySelector('.xp-window').hidden,true);await click(dom,d.querySelector('.desktop-icons button'));assert.equal(d.querySelector('input:checked').value,'C');
 await click(dom,d.querySelector('.start-button'));assert.ok(d.querySelector('.start-menu'));await click(dom,d.querySelector('.start-menu button'));assert.equal(d.querySelector('.start-menu'),null);
 await click(dom,button(dom,'使用说明'));assert.ok(d.querySelector('[role="dialog"]'));d.defaultView.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'}));await wait(20);assert.equal(d.querySelector('[role="dialog"]'),null);dom.window.close();
});
test('XP result still supports PNG download, native sharing, copy link and score details',async()=>{
 const answers=Object.fromEntries(['A','A','A','D','D','D','B','A','E','A','A','D','A'].map((a,i)=>[`Q${i+1}`,a]));const dom=await setup(JSON.stringify({version:DATA_VERSION,answers,index:12,page:'result'}));const w=dom.window,d=w.document;
 await click(dom,button(dom,'继续上次'));let downloaded=null,copied='',shared=null;Object.defineProperty(d,'fonts',{value:{ready:Promise.resolve()}});w.HTMLCanvasElement.prototype.toBlob=function(callback){assert.equal(this.width,1080);assert.equal(this.height,1350);callback(new w.Blob(['png'],{type:'image/png'}));};w.URL.createObjectURL=()=> 'blob:result';w.URL.revokeObjectURL=()=>{};const anchorClick=w.HTMLAnchorElement.prototype.click;w.HTMLAnchorElement.prototype.click=function(){if(this.download)downloaded=this.download;else anchorClick.call(this);};Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});
 await click(dom,button(dom,'保存结果图片'));assert.equal(downloaded,'地球Online-回血人格.png');await click(dom,button(dom,'分享 / 复制链接'));assert.equal(copied,'http://localhost/');w.navigator.share=async data=>{shared=data;};await click(dom,button(dom,'分享 / 复制链接'));assert.equal(shared.url,'http://localhost/');assert.equal(JSON.stringify(shared).includes('Q4'),false);
 await click(dom,button(dom,'计分说明'));assert.equal(d.querySelector('#panel-scoring').hidden,false);assert.equal(d.querySelector('#profile-rules').open,true);assert.equal(d.querySelectorAll('.score-table-v11 tbody tr').length,6);
 await click(dom,button(dom,'回答线索与记录'));assert.equal(d.querySelectorAll('.answer-history li').length,13);assert.equal(d.querySelectorAll('.answer-history li')[12].querySelector('p').textContent,'A. 人生成就');
 await click(dom,button(dom,'推荐阅读'));assert.equal(d.querySelectorAll('.book-card').length,2);assert.equal(d.querySelector('#panel-reading').hidden,false);dom.window.close();
});
test('welcome reveals no personality names; legacy and incompatible saved answers are ignored',async()=>{
 const old=JSON.stringify({version:1,answers:{Q2:'F',Q12:'E'},index:12,page:'result'});
 for(const legacy of [false,true]){const dom=await setup(old,legacy);const d=dom.window.document;assert.equal(d.body.textContent.includes('6 UNKNOWN MODULES DETECTED'),true);for(const p of Object.values(personas))assert.equal(d.body.textContent.includes(p.name),false);assert.equal([...d.querySelectorAll('button')].some(b=>b.textContent.includes('继续上次')),false);await click(dom,button(dom,'Start Setup'));assert.equal(d.querySelectorAll('input:checked').length,0);dom.window.close();}
});
test('all six unique results render correct artwork, support text, history, reading, and scoring',async()=>{
 for(const key of Object.keys(personas)){
  const answers=Object.fromEntries(questions.map(q=>[q.questionId,[...q.options].sort((a,b)=>(b.scores[key]||0)-(a.scores[key]||0))[0].optionId]));
  const dom=await setup(JSON.stringify({version:DATA_VERSION,answers,index:12,page:'result'}));const d=dom.window.document;await click(dom,button(dom,'继续上次'));assert.equal(d.querySelector('#page-title').textContent,personas[key].name);assert.ok(d.querySelector('.result-hero canvas').getAttribute('aria-label').includes(personas[key].artLabel));assert.ok(d.querySelector('.system-message').textContent.includes(personas[key].systemMessage));assert.ok(d.querySelector('.recharge-tip').textContent.includes(personas[key].rechargeTip));
  await click(dom,button(dom,'推荐阅读'));assert.deepEqual([...d.querySelectorAll('.book-card h4')].map(e=>e.textContent),personas[key].books.map(b=>b.title));
  await click(dom,button(dom,'回答线索与记录'));assert.equal(d.querySelectorAll('.answer-history li').length,13);
  await click(dom,button(dom,'计分说明'));assert.equal(d.querySelectorAll('.score-table-v11 tbody tr').length,6);assert.equal(d.querySelector('#panel-scoring').hidden,false);dom.window.close();
 }
});
test('complete low-evidence shows exploration while normal tied candidates remain visible',async()=>{
 const base=Object.fromEntries(questions.map(q=>[q.questionId,'A']));
 const cases=[{answers:{...base,Q4:'A',Q6:'A',Q7:'A',Q8:'E',Q9:'B',Q12:'D'},title:'回血机制探索中',types:1},{answers:{...base,Q4:'A',Q6:'A',Q7:'C',Q8:'D',Q9:'B',Q12:'B'},title:'多种补给，同时在线',types:2}];
 for(const c of cases){const dom=await setup(JSON.stringify({version:DATA_VERSION,answers:c.answers,index:12,page:'result'}));const d=dom.window.document;await click(dom,button(dom,'继续上次'));assert.equal(d.querySelector('#page-title').textContent,c.title);assert.equal(d.querySelectorAll('[data-persona]').length,c.types);assert.equal(d.body.textContent.includes('undefined'),false);if(c.title==='回血机制探索中')assert.ok(d.querySelector('.status-note').textContent.includes('证据不足'));await click(dom,button(dom,'重新测试'));await click(dom,button(dom,'开始测试'));assert.equal(d.querySelectorAll('input:checked').length,0);dom.window.close();}
});

test('all seven result profiles render the same template and export complete 4:5 status cards',async()=>{
 const exploring=JSON.parse(fs.readFileSync(new URL('../data/exploring.json',import.meta.url),'utf8'));
 for(const key of [...Object.keys(personas),'EXPLORING']){
  const p=key==='EXPLORING'?exploring:personas[key];
  const answers=key==='EXPLORING'?{...Object.fromEntries(questions.map(q=>[q.questionId,['A']])),Q4:['A'],Q6:['A'],Q7:['A'],Q8:['E'],Q9:['B'],Q12:['D']}:Object.fromEntries(questions.map(q=>[q.questionId,[[...q.options].sort((a,b)=>(b.scores[key]||0)-(a.scores[key]||0))[0].optionId]]));
  const dom=await setup(JSON.stringify({version:DATA_VERSION,answers,index:12,page:'result'}));const w=dom.window,d=w.document;
  await click(dom,button(dom,'继续上次'));assert.equal(d.querySelector('#page-title').textContent,p.name);assert.equal(d.querySelectorAll('.attribute-row').length,6);assert.match(d.querySelector('.result-hero canvas').getAttribute('aria-label'),new RegExp(p.artLabel));
  await click(dom,button(dom,'查看详细分析'));assert.equal(d.querySelector('#detailed-analysis').open,true);assert.ok(d.querySelector('.system-message').textContent.includes(p.systemMessage));assert.ok(d.querySelector('.recharge-tip').textContent.includes(p.rechargeTip));
  const texts=[];const original=w.HTMLCanvasElement.prototype.getContext;w.HTMLCanvasElement.prototype.getContext=function(...args){const ctx=original.apply(this,args);return new Proxy(ctx,{get:(target,name)=>name==='fillText'?text=>texts.push(text):target[name]});};
  Object.defineProperty(d,'fonts',{value:{ready:Promise.resolve()}});let downloaded=false;
  w.HTMLCanvasElement.prototype.toBlob=function(cb){assert.equal(this.width,1080);assert.equal(this.height,1350);cb(new w.Blob(['png'],{type:'image/png'}));};w.URL.createObjectURL=()=> 'blob:card';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){downloaded=!!this.download;};
  await click(dom,button(dom,'保存结果图片'));assert.equal(downloaded,true);assert.ok(texts.includes(p.name));assert.ok(texts.some(t=>t.includes('Earth Online')));for(const dimension of ['ACT','RESET','SOCIAL','LUCKY','THINK','SAVE'])assert.ok(texts.some(t=>t.startsWith(dimension+' ')));assert.equal(texts.some(t=>/NaN|undefined/.test(t)),false);
  await click(dom,button(dom,'推荐阅读'));assert.equal(d.querySelectorAll('.book-card').length,2);assert.ok(d.querySelector('.book-card').textContent.includes(p.books[0].author));
  await click(dom,button(dom,'计分说明'));assert.equal(d.querySelectorAll('.score-table-v11 tbody tr').length,6);assert.equal(d.querySelector('.score-table-v11').textContent.includes('EXPLORING'),false);dom.window.close();
 }
});

test('Q13 cancels to an empty answer, restores on return, and keeps G exclusive',async()=>{
 const dom=await setup(JSON.stringify({version:DATA_VERSION,answers:{Q12:['D'],Q13:['G']},index:12,page:'quiz'})),d=dom.window.document;
 await click(dom,button(dom,'继续上次'));assert.equal(d.querySelector('input:checked').value,'G');assert.equal(d.querySelectorAll('.selection-hint').length,2);
 await click(dom,d.querySelector('input[value="G"]'));assert.equal(button(dom,'查看我的回血人格').disabled,true);await click(dom,d.querySelector('input[value="A"]'));assert.equal(button(dom,'查看我的回血人格').disabled,false);
 await click(dom,button(dom,'上一题'));await click(dom,button(dom,'下一题'));assert.equal(d.querySelector('input:checked').value,'A');await click(dom,d.querySelector('input[value="G"]'));assert.equal(d.querySelectorAll('input:checked').length,1);assert.equal(d.querySelector('input:checked').value,'G');dom.window.close();
});

test('valid v1.2 array progress migrates safely and resetting cannot resurrect it',async()=>{
 const saved=JSON.stringify({version:'1.2',answers:{Q9:['D','F'],Q13:['G']},index:8,page:'quiz'});
 const dom=await setup(saved,false,'earth-recharge-v1.2'),d=dom.window.document;
 await click(dom,button(dom,'继续上次'));assert.deepEqual([...d.querySelectorAll('input:checked')].map(e=>e.value),['D','F']);assert.equal(JSON.parse(dom.window.localStorage.getItem('earth-recharge-v1.5')).version,'1.5');
 // Complete only the missing answers through a seeded result to exercise the reset control.
 dom.window.close();
 const complete=Object.fromEntries(questions.map(q=>[q.questionId,['A']]));const result=await setup(JSON.stringify({version:'1.2',answers:complete,index:12,page:'result'}),false,'earth-recharge-v1.2');
 await click(result,button(result,'继续上次'));await click(result,button(result,'重新测试'));assert.equal(result.window.localStorage.getItem('earth-recharge-v1.5'),null);assert.equal(result.window.localStorage.getItem('earth-recharge-v1.2'),null);result.window.close();
});

test('Save Complete, persistent My Saves, historical opening and duplicate protection work end to end',async()=>{
 const dom=await setup(JSON.stringify({version:DATA_VERSION,answers:completeAnswers(),index:12,page:'result',sessionId:'ui-run-1',completedAt:'2026-10-18T14:30:00.000Z'})),w=dom.window,d=w.document;
 await click(dom,button(dom,'继续上次'));await click(dom,button(dom,'保存到我的存档'));assert.ok(d.querySelector('[aria-label="Earth Online · Save Complete"]'));assert.equal(JSON.parse(w.localStorage.getItem(ARCHIVE_KEY)).records.length,1);
 await click(dom,button(dom,'继续探索'));await click(dom,button(dom,'已保存到我的存档'));assert.equal(d.querySelector('[aria-label="Earth Online · Save Complete"]'),null);assert.equal(JSON.parse(w.localStorage.getItem(ARCHIVE_KEY)).records.length,1);
 await click(dom,button(dom,'重新测试'));assert.equal(JSON.parse(w.localStorage.getItem(ARCHIVE_KEY)).records.length,1);
 const savesIcon=d.querySelectorAll('.desktop-icons button')[1];await mouse(dom,savesIcon);assert.equal(d.querySelector('.saves-window').hidden,true);await double(dom,savesIcon);assert.equal(d.querySelector('.saves-window').hidden,false);assert.equal(d.querySelectorAll('.sav-file').length,1);
 await mouse(dom,d.querySelector('.sav-file'));assert.equal(d.querySelector('.historical-banner'),null);await double(dom,d.querySelector('.sav-file'));assert.ok(d.querySelector('.historical-banner'));assert.equal(d.querySelector('#page-title').textContent,personas.LUCKY.name);assert.equal(d.querySelector('.archive-profilebar').textContent.includes('历史存档只读'),true);
 await click(dom,button(dom,'返回我的存档'));assert.equal(d.querySelector('.saves-window').hidden,false);
 const persisted=w.localStorage.getItem(ARCHIVE_KEY);dom.window.close();const fresh=await setup(null,false,undefined,{[ARCHIVE_KEY]:persisted});await click(fresh,fresh.window.document.querySelectorAll('.desktop-icons button')[1]);assert.equal(fresh.window.document.querySelectorAll('.sav-file').length,1);fresh.window.close();
});

test('historical UI reads frozen metadata and stored percentages; deletion requires confirmation',async()=>{
 const one=archiveFixture('one'),two=archiveFixture('two');one.version='1.3';one.snapshot.display.title='旧版本保存的标题';one.snapshot.status.attributes[0].percent=12.3;one.snapshot.questions[0].text='旧版第一题';
 const dom=await setup(null,false,undefined,{[ARCHIVE_KEY]:JSON.stringify({schemaVersion:1,records:[one,two]})}),d=dom.window.document;
 await click(dom,d.querySelector('[aria-label="关闭窗口并保留进度"]'));await click(dom,d.querySelectorAll('.desktop-icons button')[1]);await double(dom,d.querySelector('.sav-file'));assert.equal(d.querySelector('.desktop>.xp-window').hidden,false);assert.equal(d.querySelector('#page-title').textContent,'旧版本保存的标题');assert.equal(d.querySelector('.attribute-row output').textContent,'12.3%');assert.ok(d.querySelector('.historical-banner').textContent.includes('1.3'));
 const texts=[],w=dom.window,ctx=w.HTMLCanvasElement.prototype.getContext;w.HTMLCanvasElement.prototype.getContext=function(...args){const target=ctx.apply(this,args);return new Proxy(target,{get:(t,k)=>k==='fillText'?value=>texts.push(value):t[k]});};Object.defineProperty(d,'fonts',{value:{ready:Promise.resolve()}});w.HTMLCanvasElement.prototype.toBlob=cb=>cb(new w.Blob(['png']));w.URL.createObjectURL=()=> 'blob:history';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 await click(dom,button(dom,'保存结果图片'));assert.ok(texts.includes('旧版本保存的标题'));assert.ok(texts.includes('12.3%'));assert.ok(texts.includes('Generated by Earth Online · v1.3'));assert.ok(texts.some(t=>t.includes('2026')));
 await click(dom,button(dom,'回答线索与记录'));assert.equal(d.querySelector('.answer-history h3').textContent,'旧版第一题');await click(dom,button(dom,'返回我的存档'));await mouse(dom,d.querySelector('.sav-file'));
 await click(dom,button(dom,'删除存档'));assert.ok(d.querySelector('[role=alertdialog]'));await click(dom,button(dom,'取消'));assert.equal(d.querySelectorAll('.sav-file').length,2);
 await click(dom,button(dom,'删除存档'));await click(dom,button(dom,'删除此存档'));const remaining=JSON.parse(dom.window.localStorage.getItem(ARCHIVE_KEY)).records;assert.equal(remaining.length,1);assert.equal(remaining[0].id,two.id);dom.window.close();
});

test('archive quota failure shows no success dialog and keeps the result visible',async()=>{
 const dom=await setup(JSON.stringify({version:DATA_VERSION,answers:completeAnswers(),index:12,page:'result'})),d=dom.window.document,w=dom.window;await click(dom,button(dom,'继续上次'));
 const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k===ARCHIVE_KEY)throw new w.DOMException('Storage full','QuotaExceededError');return original.call(this,k,v);};
 await click(dom,button(dom,'保存到我的存档'));assert.equal(d.querySelector('[aria-label="Earth Online · Save Complete"]'),null);assert.ok(d.querySelector('.toast').textContent.includes('存档失败'));assert.equal(d.querySelector('#page-title').textContent,personas.LUCKY.name);assert.equal(w.localStorage.getItem(ARCHIVE_KEY),null);dom.window.close();
});

test('Q10 exclusive radios cancel themselves, switch, submit alone and restore on return',async()=>{
 const dom=await setup(JSON.stringify({version:DATA_VERSION,answers:{Q9:['B']},index:9,page:'quiz'})),d=dom.window.document;await click(dom,button(dom,'继续上次'));assert.equal(d.querySelectorAll('input[type=checkbox]').length,4);assert.equal(d.querySelectorAll('input[type=radio]').length,2);
 for(const id of ['A','B','C'])await click(dom,d.querySelector(`input[value="${id}"]`));assert.deepEqual([...d.querySelectorAll('input:checked')].map(e=>e.value),['A','B']);
 await click(dom,d.querySelector('input[value="E"]'));assert.deepEqual([...d.querySelectorAll('input:checked')].map(e=>e.value),['E']);await click(dom,d.querySelector('input[value="E"]'));assert.equal(d.querySelectorAll('input:checked').length,0);assert.equal(button(dom,'下一题').disabled,true);
 await click(dom,d.querySelector('input[value="F"]'));assert.equal(button(dom,'下一题').disabled,false);await click(dom,button(dom,'下一题'));await click(dom,button(dom,'上一题'));assert.equal(d.querySelector('input:checked').value,'F');await click(dom,d.querySelector('input[value="A"]'));assert.equal(d.querySelector('input:checked').value,'A');dom.window.close();
});

test('mouse shortcuts require a double click; keyboard/touch activation and folder controls remain available',async()=>{
 const dom=await setup(),d=dom.window.document;await click(dom,d.querySelector('[aria-label="最小化窗口"]'));const icons=d.querySelectorAll('.desktop-icons button');
 await mouse(dom,icons[0]);assert.equal(d.querySelector('.xp-window').hidden,true);assert.equal(icons[0].getAttribute('aria-pressed'),'true');await double(dom,icons[0]);assert.equal(d.querySelector('.xp-window').hidden,false);
 await mouse(dom,icons[2]);assert.equal(d.querySelector('[role=dialog]'),null);await double(dom,icons[2]);assert.ok(d.querySelector('[role=dialog]'));await click(dom,d.querySelector('[aria-label="关闭使用说明"]'));
 await click(dom,icons[1]);assert.equal(d.querySelector('.saves-window').hidden,false);await double(dom,icons[1]);assert.equal(d.querySelectorAll('.saves-window').length,1);assert.ok(d.querySelector('.saves-empty'));
 await click(dom,d.querySelector('[aria-label="最大化我的存档"]'));assert.ok(d.querySelector('.saves-maximized'));await click(dom,d.querySelector('[aria-label="还原我的存档"]'));await click(dom,d.querySelector('[aria-label="最小化我的存档"]'));assert.equal(d.querySelector('.saves-window').hidden,true);await click(dom,d.querySelector('[aria-label="恢复或最小化我的存档窗口"]'));assert.equal(d.querySelector('.saves-window').hidden,false);await click(dom,d.querySelector('[aria-label="关闭我的存档"]'));
 const touch=new dom.window.Event('pointerdown',{bubbles:true});Object.defineProperty(touch,'pointerType',{value:'touch'});icons[1].dispatchEvent(touch);await mouse(dom,icons[1]);assert.equal(d.querySelector('.saves-window').hidden,false);dom.window.close();
});

test('old incompatible Q10 progress requests re-answer without deleting the old bytes or archive',async()=>{
 const old=JSON.stringify({version:'1.3',answers:{...completeAnswers(),Q10:['E','F']},index:12,page:'result'}),archive=JSON.stringify([{id:'old-record',type:'ACT',scores:{ACT:2},custom:'preserve'}]);
 const dom=await setup(old,false,'earth-recharge-v1.3',{[ARCHIVE_KEY]:archive}),d=dom.window.document;await click(dom,button(dom,'继续上次'));assert.match(d.querySelector('#page-title').textContent,/^Q10/);assert.equal(d.querySelectorAll('input:checked').length,0);assert.equal(dom.window.localStorage.getItem('earth-recharge-v1.3'),old);assert.equal(dom.window.localStorage.getItem(ARCHIVE_KEY),archive);
 await click(dom,d.querySelectorAll('.desktop-icons button')[1]);await double(dom,d.querySelector('.sav-file'));assert.ok(d.querySelector('.legacy-save'));assert.ok(d.querySelector('.legacy-save').textContent.includes('旧版本'));assert.equal(dom.window.localStorage.getItem(ARCHIVE_KEY),archive);dom.window.close();
});
