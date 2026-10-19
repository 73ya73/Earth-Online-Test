// Optional local browser QA. All external requests are blocked/mocked: no research rows.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const fixtures=JSON.parse(fs.readFileSync(new URL('../reports/v1.7-fixtures.json',import.meta.url)));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const scenario of [
  {name:'production-mobile',url:'http://127.0.0.1:5187/Earth-Online-Test/',fixture:'ACT',preview:false},
  {name:'candidate-multi-mobile',url:'http://127.0.0.1:5188/',fixture:'threePlus',preview:true,title:'Multi-Recharge'},
  {name:'candidate-exploring-mobile',url:'http://127.0.0.1:5188/',fixture:'EXPLORING',preview:true,title:'Exploring Your Recharge Style'},
  {name:'candidate-exploring-desktop',url:'http://127.0.0.1:5188/',fixture:'EXPLORING',preview:true,title:'Exploring Your Recharge Style'}
 ]){
  const context=await browser.newContext({viewport:scenario.name.includes('mobile')?{width:375,height:812}:{width:1280,height:900}}),posts=[],errors=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=request.url();
   if(url.startsWith('http://127.0.0.1:'))return route.continue();
   if(url.includes('.supabase.co/')&&request.method()==='POST'){
    const payload=request.postDataJSON();posts.push(payload);
    return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({ok:true,submission_id:payload.submission_id,status:'inserted'})});
   }
   if(url.includes('.supabase.co/')&&request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST'}});
   return route.abort();
  });
  const answers={...fixtures[scenario.fixture]};delete answers.Q13;
  await context.addInitScript(({answers})=>{
   localStorage.setItem('earth-recharge-locale','en');
   localStorage.setItem('earth-recharge-v1.5',JSON.stringify({version:'1.5',answers,index:12,page:'quiz',sessionId:'browser-qa'}));
  },{answers});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(scenario.url);await page.getByRole('heading',{name:"What's Your Mental Recharge Mode?"}).waitFor();
  assert.equal(await page.title(),"What's Your Mental Recharge Mode? · Earth Online");
  assert.equal(await page.locator('.unknown-modules > span').innerText(),'8 Possible Results · Find Your Recharge Mode');
  assert.equal((await page.locator('.lead').innerText()).replace(/\s+/g,' '),'When life drains your HP, how do you recharge?');
  assert.ok(!(await page.locator('.welcome').innerText()).includes('Discover Your Recharge Style'));
  await page.locator('.language-switch button[lang="zh-CN"]').click();
  assert.equal(await page.locator('.intro h1').innerText(),'测测你的精神回血机制');
  assert.equal(await page.title(),'测测你的精神回血机制 · Earth Online');
  assert.equal(await page.locator('.unknown-modules > span').innerText(),'8 种可能结果，解锁你的精神回血方式');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Chinese welcome must fit viewport');
  await page.locator('.language-switch button[lang="en"]').click();
  assert.equal(await page.locator('.intro h1').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,'English welcome title must fit');
  await page.screenshot({path:fileURLToPath(new URL('../../earth-recharge-v1.7-welcome-'+scenario.name+'.png',import.meta.url)),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'welcome must fit mobile viewport');
  await page.getByRole('button',{name:'Resume your test'}).click();await page.locator('input[value="A"]').check();
  await page.locator('.language-switch button[lang="zh-CN"]').click();assert.equal(await page.locator('input[value="A"]').isChecked(),true);
  await page.locator('.language-switch button[lang="en"]').click();await page.getByRole('button',{name:/View My Recharge Profile/}).click();
  await page.locator('.result-hero h1').waitFor();
  if(scenario.preview){
   assert.equal(await page.locator('.result-hero h1').innerText(),scenario.title);assert.equal(posts.length,0);
   const queue=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('earth-recharge-outbox-v2:')).map(k=>JSON.parse(localStorage.getItem(k))));
   assert.equal(queue.length,1);assert.equal(queue[0].attempts,0);assert.equal(queue[0].payload.locale,'en');assert.equal(queue[0].payload.result_type[0],scenario.fixture==='EXPLORING'?'EXPLORING':'MULTI');
   await page.locator('#tab-scoring').click();assert.equal(await page.locator('.candidate-rules').isVisible(),true);await page.locator('#tab-general').click();
  }else{assert.equal(await page.locator('[data-research-debug]').count(),0);assert.equal(posts.length,1);}
  assert.doesNotMatch(await page.locator('.results').innerText(),/[\u3400-\u9fff]/);
  const labels=['ACT · Action','RESET · Recovery','SOCIAL · Social Link','LUCKY · Luck','THINK · Analysis','SAVE · Memory'];
  assert.deepEqual(await page.locator('.attribute-row > span').allTextContents(),labels);
  assert.equal(await page.locator('.attribute-row > span small').count(),0);
  const before=await page.locator('.attribute-row output').allTextContents();
  await page.locator('.language-switch button[lang="zh-CN"]').click();
  assert.equal(await page.locator('.attribute-row > span small').count(),6);
  assert.deepEqual(await page.locator('.attribute-row output').allTextContents(),before);
  await page.locator('.language-switch button[lang="en"]').click();
  assert.deepEqual(await page.locator('.attribute-row output').allTextContents(),before);
  assert.deepEqual(await page.locator('.attribute-row > span').allTextContents(),labels);
  if(scenario.fixture==='EXPLORING'){
   assert.equal(await page.locator('.quote').innerText(),'Your recharge style is still taking shape.');
   assert.equal(await page.locator('.exploration-body').innerText(),"Your answers suggest a few possible directions to explore, but there isn't enough evidence yet to identify one main recharge style.");
   assert.equal(await page.locator('.exploration-directions').count(),1);
   assert.ok(await page.locator('.exploration-directions li').count()<=2);
   await page.locator('.language-switch button[lang="zh-CN"]').click();
   assert.equal(await page.locator('.quote').innerText(),'你的精神系统还没有固定的回血配方。');
   assert.equal(await page.locator('.exploration-directions h2').innerText(),'可以继续探索的方向');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Chinese exploration must fit viewport');
   await page.locator('.language-switch button[lang="en"]').click();
  }else assert.equal(await page.locator('.exploration-directions').count(),0);
  assert.equal(await page.locator('.attribute-row > span').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)),true,'mechanism labels must fit their cells');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'result must fit viewport');
  const image=new URL('../../earth-recharge-v1.7-'+scenario.name+'.png',import.meta.url);
  await page.screenshot({path:fileURLToPath(image),fullPage:true});
  if(!scenario.preview){
   const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:/^Save Result Image/}).click();
   const download=await downloadEvent;assert.equal(download.suggestedFilename(),'EarthOnline-RechargeProfile.png');
   await download.saveAs(fileURLToPath(new URL('../../earth-recharge-v1.7-share-en.png',import.meta.url)));
  }
  await page.getByRole('button',{name:'Save to My Saves',exact:true}).click();await page.getByRole('heading',{name:'Save Complete!'}).waitFor();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS:',scenario.name,'language/progress, localized result, upload isolation, archive, responsive width and no runtime errors.');
  await context.close();
 }
}finally{await browser.close();}
