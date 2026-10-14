import fs from 'node:fs';
import {calculate,KEYS} from '../src/scoring/engine.js';
const qs=JSON.parse(fs.readFileSync(new URL('../src/data/questions.json',import.meta.url),'utf8'));
let seed=20261010;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const count=10000;const wins=Object.fromEntries(KEYS.map(k=>[k,0]));const statuses={single:0,tie:0,mixed:0,insufficient:0};
for(let i=0;i<count;i++){const answers=Object.fromEntries(qs.map(q=>[q.questionId,q.options[Math.floor(random()*q.options.length)].optionId]));const r=calculate(qs,answers);statuses[r.status]++;if(r.primary)wins[r.primary]++;}
const report={seed:20261010,simulations:count,wins,winRatios:Object.fromEntries(Object.entries(wins).map(([k,n])=>[k,n/count])),statuses,statusRatios:Object.fromEntries(Object.entries(statuses).map(([k,n])=>[k,n/count])),note:'均匀随机选择只检查算法结构，不代表真实人群分布。规则为待校准试行配置。'};
fs.mkdirSync(new URL('../reports/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../reports/simulation.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
