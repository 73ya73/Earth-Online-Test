// Synthetic browser QA: every external request is blocked. No participant records are used.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {calculateV17} from '../src/scoring/v17.js';
import {explorationAdvice} from '../src/data/exploration-advice.js';
import {t} from '../src/i18n/index.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const questions=JSON.parse(fs.readFileSync(new URL('../src/data/questions.json',import.meta.url)));
const neutral={...Object.fromEntries(questions.map(q=>[q.questionId,['A']])),Q6:['A'],Q7:['A'],Q8:['E'],Q9:['B'],Q11:['F'],Q12:['D']};
const output=new URL('../../exploring-ux-preview/',import.meta.url);fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const [name,patch,items] of [
  ['reset-think',{Q4:['B'],Q6:['E']},['RESET','THINK']],
  ['single',{},['ACT']],['three-tied',{Q4:['B'],Q6:['C'],Q9:['D']},[]]
 ])for(const width of [375,1280]){
  const answers={...neutral,...patch},result=calculateV17(questions,answers);assert.equal(result.finalType,'EXPLORING');
  const context=await browser.newContext({viewport:{width,height:960}}),errors=[];let posts=0;
  await context.route('**/*',route=>{
   if(route.request().url().startsWith('http://127.0.0.1:5187/'))return route.continue();
   if(route.request().method()==='POST')posts++;return route.abort();
  });
  await context.addInitScript(({answers})=>{
   localStorage.setItem('earth-recharge-locale','zh');
   localStorage.setItem('earth-recharge-v1.5',JSON.stringify({version:'1.5',answers,index:12,page:'result',algorithmVersion:'pilot-1.7-raw-v1'}));
  },{answers});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5187/Earth-Online-Test/');await page.getByRole('button',{name:/继续上次的结果/}).click();await page.locator('.result-hero h1').waitFor();
  const before=await page.locator('.attribute-row output').allTextContents();
  for(const locale of ['zh','en']){
   await page.locator(`.language-switch button[lang="${locale==='zh'?'zh-CN':'en'}"]`).click();
   assert.equal(await page.locator('.result-hero h1').innerText(),locale==='zh'?'回血机制探索中':'Exploring Your Recharge Mode');
   assert.deepEqual(await page.locator('.attribute-row output').allTextContents(),before);
   assert.equal(await page.locator('.recharge-clues li').count(),items.length);
   const advice=await page.locator('.exploration-try p').innerText();
   const expected=explorationAdvice(items);assert.equal(advice,t(expected.body,{},locale));
   assert.equal(await page.locator('.exploration-try small').innerText(),t(expected.observation,{},locale));
   if(!items.length)assert.ok((await page.locator('.exploration-tie').innerText()).includes('3'));
   assert.equal(await page.locator('.exploration-directions meter,.exploration-directions progress,.exploration-directions canvas').count(),0);
   assert.equal(await page.locator('.exploration-directions').evaluate(n=>n.textContent.includes('%')),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.equal(await page.locator('.exploration-try').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
   const order=await page.locator('#panel-general').evaluate(n=>[...n.children].slice(0,3).map(n=>n.className));
   assert.deepEqual(order,['result-hero','exploration-directions','system-status']);
   assert.equal(await page.locator('[data-research-debug]').count(),0);
   await page.screenshot({path:fileURLToPath(new URL(`${name}-${locale}-${width===375?'mobile':'desktop'}.png`,output)),fullPage:true});
  }
  assert.equal(posts,0);assert.deepEqual(errors,[]);await context.close();
  console.log('PASS',name,width,'bilingual clues/actions, unchanged scores, reading order, no overflow/uploads');
 }
}finally{await browser.close();}
