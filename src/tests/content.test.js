import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pixelArt,ART_KEYS} from '../data/pixel-art.js';
import {KEYS} from '../scoring/engine.js';
const personas=JSON.parse(fs.readFileSync(new URL('../data/personas.json',import.meta.url),'utf8'));
const qs=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url),'utf8'));
test('six official personalities each have unique art, encouragement, tip, and two verified-source books',()=>{
 assert.deepEqual(Object.keys(personas),KEYS);assert.deepEqual(ART_KEYS,KEYS);
 assert.equal(new Set(KEYS.map(k=>JSON.stringify(pixelArt(k)))).size,6);
 for(const k of KEYS){const p=personas[k];assert.ok(p.description.length>40);assert.ok(p.systemMessage.length>30);assert.ok(p.rechargeTip.length>25);assert.ok(p.artLabel);assert.equal(p.books.length,2);for(const book of p.books){assert.ok(book.title&&book.author&&book.reason);assert.ok(book.url.startsWith('https://'));}}
 assert.equal(new Set(KEYS.map(k=>personas[k].systemMessage)).size,6);assert.equal(new Set(KEYS.flatMap(k=>personas[k].books.map(b=>b.title))).size,12);
});
test('all pixel commands are finite, inside the shared 64px canvas, and use explicit colors',()=>{
 for(const k of [...KEYS,'unknown'])for(const [x,y,w,h,color] of pixelArt(k)){assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=64&&y+h<=64,`${k}: out-of-bounds rect`);assert.match(color,/^#[0-9a-f]{3,6}$/i);}
});
test('Q2, Q10 and Q12 follow the updated workbook rather than old option positions',()=>{
 const q2=qs[1];assert.equal(q2.options[5].text,'F. 多重副本参与中');assert.equal(q2.options[6].text,'G. 目前版本稳定，暂无重大Bug');assert.equal(q2.scoringEnabled,false);
 assert.equal(qs[9].options[3].text,'D. 放进收纳盒做纪念');assert.equal(qs[9].options[5].text,'F. 不刻意留存');assert.equal(qs[11].options[6].text,'G. 不留存档，继续奇遇');
});
