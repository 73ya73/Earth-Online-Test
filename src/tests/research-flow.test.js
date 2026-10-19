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
async function boot(seed={},fetcher=async(_u,o)=>({ok:true,status:200,json:async()=>({ok:true,status:'inserted',submission_id:JSON.parse(o.body).submission_id})})){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.scrollTo=()=>{};w.fetch=fetcher;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:(_,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:20}):()=>{},set:()=>true});
 for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,v);
 w.eval(script);await delay(40);return dom;
}
const snapshot=w=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return [k,w.localStorage.getItem(k)];}));
const pending=()=>({'earth-recharge-v1.5':JSON.stringify({version:'1.5',answers:Object.fromEntries(questions.slice(0,12).map(q=>[q.questionId,['A']])),index:12,page:'quiz',sessionId:'integration'})});
async function finish(w){button(w,'继续上次').click();await delay(30);w.document.querySelector('input[value="A"]').click();await delay(25);button(w,'查看我的回血人格').click();await delay(850);}

test('real production UI discloses mode before start; completion auto-submits only when configured',async()=>{
 const posts=[],dom=await boot(pending(),async(url,options)=>{posts.push({url,options});return {ok:true,status:200,json:async()=>({ok:true,status:'inserted',submission_id:JSON.parse(options.body).submission_id})};});const w=dom.window;
 const notice=w.document.querySelector('.intro .setup-note');assert.ok(notice);const enabled=notice.textContent.includes('系统会自动记录');assert.equal(posts.length,0);
 if(process.env.EXPECT_RESEARCH_UPLOAD==='true')assert.equal(enabled,true,'The production bundle must enable research upload and disclose it before Start Setup');
 assert.equal(w.document.querySelector('.intro .data-notice'),null);assert.ok(notice.querySelector('.pixel-icon'));assert.match(notice.textContent,/欢迎使用精神回血检测向导/);if(enabled)assert.equal(notice.querySelector('p').textContent,'本测试为匿名趣味探索，非心理诊断。完成测试后，系统会自动记录本次答题选项及测试结果，用于统计和优化体验。');
 await finish(w);assert.ok(w.document.querySelector('.results'));assert.equal(posts.length,enabled?1:0);
 if(enabled){const record=JSON.parse(posts[0].options.body);assert.equal(Object.keys(record.answers).length,13);assert.equal(Object.keys(record).length,5);assert.ok(Array.isArray(record.result_type));assert.equal(posts[0].url,'https://qwkwtcbkxjlyelvbvwpv.supabase.co/functions/v1/submit-research');}
 button(w,'首页').click();await delay(25);button(w,'继续上次').click();await delay(30);assert.equal(posts.length,enabled?1:0);
 const saved=snapshot(w);dom.window.close();let refreshCalls=0;const refreshed=await boot(saved,async()=>{refreshCalls++;throw Error('refresh must not submit');});button(refreshed.window,'继续上次').click();await delay(40);assert.ok(refreshed.window.document.querySelector('.results'));assert.equal(refreshCalls,0);
 button(refreshed.window,'保存到我的存档').click();await delay(30);assert.match(refreshed.window.document.body.textContent,/Save Complete/);assert.ok(refreshed.window.localStorage.getItem('earth-recharge-saves-v1'));refreshed.window.close();
});
test('failed statistical upload does not block real result or archive; restarting gets fresh UUID',async()=>{
 let calls=0;const records=[],dom=await boot(pending(),async(_u,o)=>{calls++;records.push(JSON.parse(o.body));throw Error('network down');});const w=dom.window,enabled=w.document.querySelector('.intro .setup-note').textContent.includes('系统会自动记录');
 await finish(w);assert.ok(button(w,'保存结果图片'));assert.ok(button(w,'分享 / 复制链接'));assert.equal(calls,enabled?1:0);
 let downloaded='';Object.defineProperty(w.document,'fonts',{value:{ready:Promise.resolve()}});w.HTMLCanvasElement.prototype.toBlob=function(callback){assert.equal(this.width,1080);assert.equal(this.height,1350);callback(new w.Blob(['png'],{type:'image/png'}));};w.URL.createObjectURL=()=> 'blob:failure-result';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){downloaded=this.download;};
 button(w,'保存结果图片').click();await delay(50);assert.equal(downloaded,'地球Online-回血人格.png');assert.match(w.document.body.textContent,/结果图片已生成/);assert.equal(calls,enabled?1:0);
 button(w,'保存到我的存档').click();await delay(30);assert.match(w.document.body.textContent,/Save Complete/);button(w,'继续探索').click();await delay(30);
 button(w,'重新测试').click();await delay(30);assert.ok(w.localStorage.getItem('earth-recharge-saves-v1'));button(w,'开始测试').click();await delay(25);
 for(let i=0;i<13;i++){w.document.querySelector('input[value="A"]').click();await delay(20);button(w,i===12?'查看我的回血人格':'下一题').click();await delay(20);}await delay(850);
 assert.ok(w.document.querySelector('.results'));if(enabled){const ids=new Set(records.map(r=>r.submission_id));assert.equal(ids.size,2);}else assert.equal(calls,0);w.close();
});

test('two newly completed tests submit two distinct records while refresh submits nothing',async()=>{
 const records=[],fetcher=async(_u,o)=>{records.push(JSON.parse(o.body));return {ok:true,status:200,json:async()=>({ok:true,status:'inserted',submission_id:JSON.parse(o.body).submission_id})};};
 const dom=await boot(pending(),fetcher),w=dom.window,enabled=w.document.querySelector('.intro .setup-note').textContent.includes('系统会自动记录');
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

test('offline completion is queued before loading finishes; closing and reopening welcome resumes same ID',async()=>{
 let calls=0;const dom=await boot(pending(),async()=>{calls++;throw Error('must not fetch offline');}),w=dom.window;
 const enabled=w.document.querySelector('.intro .setup-note').textContent.includes('系统会自动记录');
 Object.defineProperty(w.navigator,'onLine',{get:()=>false,configurable:true});
 button(w,'继续上次').click();await delay(25);w.document.querySelector('input[value="A"]').click();await delay(25);button(w,'查看我的回血人格').click();await delay(30);
 assert.ok(w.document.querySelector('.loading'));assert.equal(calls,0);
 const saved=snapshot(w),keys=Object.keys(saved).filter(k=>k.startsWith('earth-recharge-outbox-v2:'));
 assert.equal(keys.length,enabled?1:0);const id=enabled?JSON.parse(saved[keys[0]]).payload.submission_id:null;w.close();
 const posted=[],newDom=await boot(saved,async(_u,o)=>{const p=JSON.parse(o.body);posted.push(p);return {ok:true,status:200,json:async()=>({ok:true,status:'already_saved',submission_id:p.submission_id})};});
 await delay(80);assert.ok(newDom.window.document.querySelector('.welcome'));assert.equal(posted.length,enabled?1:0);
 if(enabled){assert.equal(posted[0].submission_id,id);assert.equal(Object.keys(snapshot(newDom.window)).filter(k=>k.startsWith('earth-recharge-outbox-v2:')).length,0);}
 newDom.window.close();
});

test('legacy attempted record resumes automatically, old sent marker does not re-upload',async()=>{
 const {createSubmission}=await import('../utils/research.js');const a=Object.fromEntries(questions.map(q=>[q.questionId,['A']]));const p=createSubmission(questions,a);
 for(const marker of ['attempted','sent']){
  let calls=0;const seed={'earth-recharge-v1.5':JSON.stringify({version:'1.5',answers:a,index:12,page:'result',researchSubmission:p}),['earth-recharge-submitted-v1:'+p.submission_id]:marker};
  const dom=await boot(seed,async(_u,o)=>{calls++;assert.equal(JSON.parse(o.body).submission_id,p.submission_id);return {ok:true,status:200,json:async()=>({ok:true,status:'already_saved',submission_id:p.submission_id})};});
  const enabled=dom.window.document.querySelector('.intro .setup-note').textContent.includes('系统会自动记录');await delay(40);assert.equal(calls,enabled&&marker==='attempted'?1:0);dom.window.close();
 }
});

test('welcome title, tab title and eight-result footer follow the selected language without uploads',async()=>{
 let calls=0;const dom=await boot({},async()=>{calls++;throw Error('welcome must not upload');}),w=dom.window;
 try{
  assert.equal(w.document.querySelector('.intro h1').textContent,'测测你的精神回血机制');
  assert.equal(w.document.querySelector('.unknown-modules > span').textContent,'8 种可能结果，解锁你的精神回血方式');
  assert.equal(w.document.title,'测测你的精神回血机制 · Earth Online');
  w.document.querySelector('.language-switch button[lang="en"]').click();await delay(35);
  assert.equal(w.document.querySelector('.intro h1').textContent,"What's Your Mental Recharge Mode?");
  assert.equal(w.document.title,"What's Your Mental Recharge Mode? · Earth Online");
  assert.equal(w.document.querySelector('.unknown-modules > span').textContent,'8 Possible Results · Find Your Recharge Mode');
  assert.equal(w.document.querySelector('.lead').textContent,'When life drains your HP,how do you recharge?');
  assert.ok(!w.document.body.textContent.includes('Discover Your Recharge Style'));
  w.document.querySelector('.language-switch button[lang="zh-CN"]').click();await delay(30);
  assert.equal(w.document.querySelector('.intro h1').textContent,'测测你的精神回血机制');
  assert.equal(w.document.querySelector('.unknown-modules > span').textContent,'8 种可能结果，解锁你的精神回血方式');assert.equal(calls,0);
 }finally{w.close();}
});

test('language switches preserve answer IDs and do not create duplicate submissions',async()=>{
 const posts=[],dom=await boot(pending(),async(_u,o)=>{const p=JSON.parse(o.body);posts.push(p);return {ok:true,status:200,json:async()=>({ok:true,submission_id:p.submission_id,status:'inserted'})};}),w=dom.window;
 w.document.querySelector('.language-switch button[lang="en"]').click();await delay(35);
 assert.match(w.document.querySelector('.welcome').textContent,/What's Your Mental Recharge Mode\?/);assert.equal(w.document.documentElement.lang,'en');
 button(w,'Resume your').click();await delay(25);assert.match(w.document.getElementById('page-title').textContent,/If you could save your Earth Online experiences/);
 w.document.querySelector('input[value="A"]').click();await delay(25);
 const ids=JSON.parse(w.localStorage.getItem('earth-recharge-v1.5')).answers;
 w.document.querySelector('.language-switch button[lang="zh-CN"]').click();await delay(25);
 assert.deepEqual(JSON.parse(w.localStorage.getItem('earth-recharge-v1.5')).answers,ids);assert.equal(w.document.querySelector('input[value="A"]').checked,true);
 w.document.querySelector('.language-switch button[lang="en"]').click();await delay(25);button(w,'View My Recharge Profile').click();await delay(850);
 assert.ok(w.document.querySelector('.results'));assert.ok(w.document.querySelector('.results').textContent.includes('Save Result Image'));
 assert.equal(posts.length,1);assert.equal(posts[0].answers.Q13[0],'A');
 for(const language of ['zh-CN','en']){w.document.querySelector('.language-switch button[lang="'+language+'"]').click();await delay(25);}assert.equal(posts.length,1);
 const body=w.document.body.textContent.replaceAll('中文','');assert.doesNotMatch(body,/[\u3400-\u9fff]/);
 button(w,'Save to My Saves').click();await delay(30);assert.match(w.document.body.textContent,/Save Complete/);w.close();
});

test('stored English locale reopens welcome in English without resetting existing answers',async()=>{
 const seed={...pending(),'earth-recharge-locale':'en'},dom=await boot(seed),w=dom.window;
 assert.equal(w.document.documentElement.lang,'en');assert.match(w.document.querySelector('.welcome').textContent,/What's Your Mental Recharge Mode\?/);
 button(w,'Resume your').click();await delay(25);assert.match(w.document.getElementById('page-title').textContent,/Q13/);assert.equal(Object.keys(JSON.parse(w.localStorage.getItem('earth-recharge-v1.5')).answers).length,12);w.close();
});

test('completed candidate session keeps original algorithm after reopening with production preview disabled',async()=>{
 const {createV17Submission}=await import('../utils/research-v17.js');
 const fixtures=JSON.parse(fs.readFileSync(new URL('../../reports/v1.7-fixtures.json',import.meta.url),'utf8'));
 const answers=fixtures.MULTI,payload=createV17Submission(questions,answers,'en');let calls=0;
 const seed={'earth-recharge-locale':'en','earth-recharge-v1.5':JSON.stringify({version:'1.5',answers,index:12,page:'result',researchSubmission:payload,algorithmVersion:payload.algorithm_version,completedAt:payload.submitted_at})};
 const dom=await boot(seed,async()=>{calls++;throw Error('must not send candidate to legacy endpoint');}),w=dom.window;
 button(w,'Resume your result').click();await delay(50);assert.equal(w.document.querySelector('.result-hero h1').textContent,'Multi-Recharge');assert.equal(calls,0);
 const records=Object.keys(snapshot(w)).filter(k=>k.startsWith('earth-recharge-outbox-v2:')).map(k=>JSON.parse(w.localStorage.getItem(k)));assert.equal(records.length,1);assert.equal(records[0].payload.submission_id,payload.submission_id);assert.equal(records[0].attempts,0);w.close();
});
