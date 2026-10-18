import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate,KEYS} from '../scoring/engine.js';
import {answerIds,toggleAnswer,validSelections} from '../scoring/answers.js';
import {ARCHIVE_KEY,createArchive,readArchive,writeArchive,deleteArchive,archiveFilename} from '../utils/archives.js';
const qs=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url),'utf8'));
const profiles={...JSON.parse(fs.readFileSync(new URL('../data/personas.json',import.meta.url),'utf8')),EXPLORING:JSON.parse(fs.readFileSync(new URL('../data/exploring.json',import.meta.url),'utf8'))};
function memory(){const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function record(sessionId='test-1'){
 const answers=Object.fromEntries(qs.map(q=>[q.questionId,[[...q.options].sort((a,b)=>(b.scores.LUCKY||0)-(a.scores.LUCKY||0))[0].optionId]]));
 const result=calculate(qs,answers),profile=profiles.LUCKY;
 return createArchive({sessionId,createdAt:'2026-10-18T14:30:00.000Z',answers,questions:qs,result,profiles,display:{types:['LUCKY'],profile,title:profile.name,quote:profile.quote,art:'LUCKY'}});
}
test('Q10 normal pairs and exclusive radios obey symmetric, cancellable constraints',()=>{
 const q=qs[9];assert.deepEqual(q.exclusiveOptions,['E','F']);assert.equal(q.exclusiveControl,'radio');assert.equal(validSelections(q).length,12);
 let ids=[];for(const id of ['A','B'])ids=toggleAnswer(q,ids,id).ids;assert.deepEqual(ids,['A','B']);assert.equal(toggleAnswer(q,ids,'C').limited,true);
 ids=toggleAnswer(q,ids,'E').ids;assert.deepEqual(ids,['E']);ids=toggleAnswer(q,ids,'F').ids;assert.deepEqual(ids,['F']);ids=toggleAnswer(q,ids,'F').ids;assert.deepEqual(ids,[]);
 assert.deepEqual(toggleAnswer(q,['E'],'D').ids,['D']);
 for(const answer of [['E','F'],['A','E'],['B','F'],['A','B','C']])assert.deepEqual(answerIds(q,answer),[]);
 for(const answer of [['E'],['F'],['A'],['B','D']])assert.ok(answerIds(q,answer).length);
});
test('Q10 exclusive shape does not imply disabled scoring; dataset scores remain untouched',()=>{
 for(const id of ['E','F']){const r=calculate(qs,{Q10:[id]});assert.equal(r.selections.length,1);assert.ok(Object.values(r.totals).every(v=>v===0));}
 const copy=structuredClone(qs);copy[9].scoringEnabled=true;copy[9].options[4].scoringEnabled=true;copy[9].options[4].scores.ACT=2;
 assert.equal(calculate(copy,{Q10:['E']}).totals.ACT,2);assert.equal(calculate(copy,{Q10:['F']}).totals.ACT,0);
});
test('full archive snapshots are detached, persisted, and deduplicated by one test session',()=>{
 const storage=memory(),first=record(),saved=writeArchive(first,storage);assert.equal(saved.duplicate,false);assert.equal(readArchive(storage).records.length,1);assert.equal(saved.record.version,'1.5');assert.deepEqual(Object.keys(first.percentages),KEYS);
 const duplicate=writeArchive(record(),storage);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.record.id,first.id);assert.equal(readArchive(storage).records.length,1);
 const second=record('test-2');writeArchive(second,storage);assert.equal(readArchive(storage).records.length,2);assert.notEqual(archiveFilename(first),archiveFilename(second));
 const historical=readArchive(storage).records.find(r=>r.id===first.id);assert.equal(historical.kind,'full');assert.equal(historical.snapshot.display.title,profiles.LUCKY.name);assert.equal(historical.snapshot.questions.length,13);assert.ok(historical.snapshot.artwork.LUCKY.length);
 first.snapshot.display.title='changed after saving';assert.notEqual(readArchive(storage).records.find(r=>r.id===first.id).snapshot.display.title,first.snapshot.display.title);
 storage.removeItem('earth-recharge-v1.5');assert.equal(readArchive(storage).records.length,2);
});
test('history retains old version scores, labels and percentages without running latest calculation',()=>{
 const storage=memory(),old=record();old.version='1.3';old.snapshot.display.title='当时的结果标题';old.snapshot.profiles.LUCKY.quote='当时的短句';old.snapshot.questions[0].text='当时的题干';old.snapshot.status.attributes[0].percent=12.3;
 writeArchive(old,storage);const restored=readArchive(storage).records[0];assert.equal(restored.version,'1.3');assert.equal(restored.snapshot.display.title,'当时的结果标题');assert.equal(restored.snapshot.questions[0].text,'当时的题干');assert.equal(restored.snapshot.status.attributes[0].percent,12.3);assert.deepEqual(restored.snapshot.result.totals,old.snapshot.result.totals);
});
test('partial legacy records and unknown fields survive appending and deleting one entry',()=>{
 const storage=memory(),old=[{type:'RESET',scores:{ACT:0,RESET:3},customField:'keep me'},'opaque old data'];storage.setItem(ARCHIVE_KEY,JSON.stringify(old));
 const before=readArchive(storage);assert.equal(before.records[0].kind,'legacy');assert.equal(before.records[0].totals.RESET,3);assert.equal(before.records.length,2);
 const added=record();writeArchive(added,storage);let loaded=readArchive(storage);const remainingId=loaded.records[2].id;deleteArchive(loaded.records[1].id,storage);loaded=readArchive(storage);assert.equal(loaded.records.length,2);assert.equal(loaded.records[1].id,remainingId);assert.equal(loaded.raw[1].legacyValue,'opaque old data');assert.equal(loaded.records[0].id,added.id);
});
test('corrupt storage and failed writes never report success or overwrite existing bytes',()=>{
 const storage=memory();storage.setItem(ARCHIVE_KEY,'broken json');assert.throws(()=>writeArchive(record(),storage),/原始记录已保留/);assert.equal(storage.getItem(ARCHIVE_KEY),'broken json');
 storage.setItem(ARCHIVE_KEY,JSON.stringify({unsupported:'future version'}));assert.throws(()=>deleteArchive('x',storage),/原始记录已保留/);assert.equal(storage.getItem(ARCHIVE_KEY),JSON.stringify({unsupported:'future version'}));
 const quota=memory();writeArchive(record(),quota);const original=quota.getItem(ARCHIVE_KEY);quota.setItem=()=>{throw new Error('QuotaExceededError');};assert.throws(()=>writeArchive(record('new-session'),quota),/QuotaExceeded/);assert.equal(quota.getItem(ARCHIVE_KEY),original);assert.throws(()=>deleteArchive(readArchive(quota).records[0].id,quota),/QuotaExceeded/);assert.equal(quota.getItem(ARCHIVE_KEY),original);
});

test('all seven profiles and mixed candidates archive completely; a malformed old snapshot cannot hide the others',()=>{
 const storage=memory();
 for(const type of [...KEYS,'EXPLORING']){
  let answers=Object.fromEntries(qs.map(q=>[q.questionId,[[...q.options].sort((a,b)=>(b.scores[type]||0)-(a.scores[type]||0))[0].optionId]]));
  if(type==='EXPLORING')answers={...answers,Q4:['A'],Q6:['A'],Q7:['A'],Q8:['E'],Q9:['B'],Q12:['D']};
  const result=calculate(qs,answers),p=profiles[type];
  const archive=createArchive({sessionId:type,answers,questions:qs,result,profiles,display:{types:[type],profile:p,title:p.name,quote:p.quote,art:type}});writeArchive(archive,storage);
 }
 const answers={...Object.fromEntries(qs.map(q=>[q.questionId,['A']])),Q4:['A'],Q6:['A'],Q7:['C'],Q8:['D'],Q9:['B'],Q12:['B']},result=calculate(qs,answers),types=result.candidates.map(c=>c.key);
 writeArchive(createArchive({sessionId:'tie',answers,questions:qs,result,profiles,display:{types,profile:null,title:'多种补给，同时在线',quote:'多种方式',art:types.join('+')}}),storage);
 assert.equal(readArchive(storage).records.length,8);assert.ok(readArchive(storage).records.every(r=>r.kind==='full'));
 const broken=record('broken');broken.snapshot.questions=[null];const raw=readArchive(storage).raw;storage.setItem(ARCHIVE_KEY,JSON.stringify({schemaVersion:1,records:[broken,...raw]}));
 const all=readArchive(storage).records;assert.equal(all.length,9);assert.equal(all[0].kind,'legacy');assert.ok(all.slice(1).every(r=>r.kind==='full'));assert.equal(all[0].raw.snapshot.questions[0],null);
});
