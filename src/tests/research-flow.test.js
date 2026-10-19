import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const questions=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url)));
const html=fs.readFileSync(new URL('../../dist/index.html',import.meta.url),'utf8');
const asset=html.match(/src="([^" ]+\.js)"/)[1].split('/').pop();
const script=fs.readFileSync(new URL(`../../dist/assets/${asset}`,import.meta.url),'utf8');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const button=(w,text)=>{const b=[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert.ok(b,text);return b;};
async function boot(seed={},fetcher=async()=>({ok:true,json:async()=>({ok:true})})){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.scrollTo=()=>{};w.fetch=fetcher;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:(_,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:20}):()=>{},set:()=>true});
 for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,v);
 w.eval(script);await delay(40);return dom;
}
const snapshot=w=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return [k,w.localStorage.getItem(k)];}));
const pending=()=>({'earth-recharge-v1.5':JSON.stringify({version:'1.5',answers:Object.fromEntries(questions.slice(0,12).map(q=>[q.questionId,['A']])),index:12,page:'quiz',sessionId:'integration'})});
async function finish(w){button(w,'继续上次').click();await delay(30);w.document.querySelector('input[value="A"]').click();await delay(25);button(w,'查看我的回血人格').click();await delay(850);}

test('real production UI discloses mode before start; completion auto-submits only when configured',async()=>{
 const posts=[],dom=await boot(pending(),async(url,options)=>{posts.push({url,options});return {ok:true,json:async()=>({ok:true})};});const w=dom.window;
 const notice=w.document.querySelector('.intro .data-notice');assert.ok(notice);const enabled=notice.textContent.includes('系统会自动记录');assert.equal(posts.length,0);
 if(process.env.EXPECT_RESEARCH_UPLOAD==='true')assert.equal(enabled,true,'The production bundle must enable research upload and disclose it before Start Setup');
 if(enabled){assert.match(notice.textContent,/无需提供姓名或联系方式/);assert.match(notice.textContent,/180 天/);assert.match(notice.textContent,/不承诺完全匿名/);}
 await finish(w);assert.ok(w.document.querySelector('.results'));assert.equal(posts.length,enabled?1:0);
 if(enabled){const record=JSON.parse(posts[0].options.body);assert.equal(Object.keys(record.answers).length,13);assert.equal(Object.keys(record).length,5);assert.ok(Array.isArray(record.result_type));assert.equal(posts[0].url,'https://qwkwtcbkxjlyelvbvwpv.supabase.co/functions/v1/submit-research');}
 button(w,'首页').click();await delay(25);button(w,'继续上次').click();await delay(30);assert.equal(posts.length,enabled?1:0);
 const saved=snapshot(w);dom.window.close();let refreshCalls=0;const refreshed=await boot(saved,async()=>{refreshCalls++;throw Error('refresh must not submit');});button(refreshed.window,'继续上次').click();await delay(40);assert.ok(refreshed.window.document.querySelector('.results'));assert.equal(refreshCalls,0);
 button(refreshed.window,'保存到我的存档').click();await delay(30);assert.match(refreshed.window.document.body.textContent,/Save Complete/);assert.ok(refreshed.window.localStorage.getItem('earth-recharge-saves-v1'));refreshed.window.close();
});
test('failed statistical upload does not block real result or archive; restarting gets fresh UUID',async()=>{
 let calls=0;const records=[],dom=await boot(pending(),async(_u,o)=>{calls++;records.push(JSON.parse(o.body));throw Error('network down');});const w=dom.window,enabled=w.document.querySelector('.data-notice').textContent.includes('系统会自动记录');
 await finish(w);assert.ok(button(w,'保存结果图片'));assert.ok(button(w,'分享 / 复制链接'));assert.equal(calls,enabled?1:0);
 let downloaded='';Object.defineProperty(w.document,'fonts',{value:{ready:Promise.resolve()}});w.HTMLCanvasElement.prototype.toBlob=function(callback){assert.equal(this.width,1080);assert.equal(this.height,1350);callback(new w.Blob(['png'],{type:'image/png'}));};w.URL.createObjectURL=()=> 'blob:failure-result';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){downloaded=this.download;};
 button(w,'保存结果图片').click();await delay(50);assert.equal(downloaded,'地球Online-回血人格.png');assert.match(w.document.body.textContent,/结果图片已生成/);assert.equal(calls,enabled?1:0);
 button(w,'保存到我的存档').click();await delay(30);assert.match(w.document.body.textContent,/Save Complete/);button(w,'继续探索').click();await delay(30);
 button(w,'重新测试').click();await delay(30);assert.ok(w.localStorage.getItem('earth-recharge-saves-v1'));button(w,'开始测试').click();await delay(25);
 for(let i=0;i<13;i++){w.document.querySelector('input[value="A"]').click();await delay(20);button(w,i===12?'查看我的回血人格':'下一题').click();await delay(20);}await delay(850);
 assert.ok(w.document.querySelector('.results'));assert.equal(calls,enabled?2:0);if(enabled)assert.notEqual(records[0].submission_id,records[1].submission_id);w.close();
});

test('two newly completed tests submit two distinct records while refresh submits nothing',async()=>{
 const records=[],fetcher=async(_u,o)=>{records.push(JSON.parse(o.body));return {ok:true,json:async()=>({ok:true})};};
 const dom=await boot(pending(),fetcher),w=dom.window,enabled=w.document.querySelector('.data-notice').textContent.includes('系统会自动记录');
 await finish(w);assert.equal(records.length,enabled?1:0);const seed=snapshot(w);w.close();
 const refreshed=await boot(seed,fetcher),r=refreshed.window;button(r,'继续上次').click();await delay(35);assert.equal(records.length,enabled?1:0);
 button(r,'重新测试').click();await delay(25);button(r,'开始测试').click();await delay(25);
 for(let i=0;i<13;i++){r.document.querySelector('input[value="A"]').click();await delay(20);button(r,i===12?'查看我的回血人格':'下一题').click();await delay(20);}await delay(850);
 assert.equal(records.length,enabled?2:0);if(enabled){assert.notEqual(records[0].submission_id,records[1].submission_id);assert.deepEqual(records[0].answers,records[1].answers);}
 r.close();
});
test('old completed results and historical archive do not backfill participant records',async()=>{
 const completed={'earth-recharge-v1.5':JSON.stringify({version:'1.5',answers:Object.fromEntries(questions.map(q=>[q.questionId,['A']])),index:12,page:'result'})};let calls=0;
 const dom=await boot(completed,async()=>{calls++;return {ok:true,json:async()=>({ok:true})};});const w=dom.window;
 button(w,'继续上次').click();await delay(35);assert.ok(w.document.querySelector('.results'));assert.equal(calls,0);
 button(w,'保存到我的存档').click();await delay(30);button(w,'查看我的存档').click();await delay(30);
 const file=w.document.querySelector('.sav-file');assert.ok(file);file.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true,detail:2}));await delay(35);assert.match(w.document.body.textContent,/Historical Save/);assert.equal(calls,0);w.close();
});
