import {KEYS} from '../scoring/engine.js';
import {systemStatus} from '../scoring/status.js';
import {pixelArt} from '../data/pixel-art.js';
export const ARCHIVE_KEY='earth-recharge-saves-v1';
export const RELEASE='1.5';
export const newId=()=>globalThis.crypto?.randomUUID?.()||`save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const copy=value=>JSON.parse(JSON.stringify(value));
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const types=new Set([...KEYS,'EXPLORING']);
function validStatus(s){return s&&Array.isArray(s.attributes)&&s.attributes.length===6&&KEYS.every(k=>s.attributes.some(a=>a.key===k&&Number.isFinite(a.percent)&&a.percent>=0&&a.percent<=100))&&Array.isArray(s.top);}
function validSnapshot(s){
 try{
 return object(s)&&object(s.result)&&object(s.result.totals)&&KEYS.every(k=>Number.isFinite(s.result.totals[k])&&Number.isFinite(s.result.theory?.[k]?.max)&&Number.isFinite(s.result.evidence?.[k]))&&Array.isArray(s.result.candidates)&&Array.isArray(s.result.selections)&&s.result.selections.every(o=>typeof o.text==='string')&&object(s.result.behavioralProfile)&&Array.isArray(s.result.contextProfile)&&object(s.result.config)&&Array.isArray(s.questions)&&s.questions.every(q=>typeof q.text==='string'&&Array.isArray(q.options))&&object(s.display)&&typeof s.display.title==='string'&&typeof s.display.quote==='string'&&typeof s.display.art==='string'&&Array.isArray(s.display.types)&&s.display.types.every(k=>types.has(k)&&typeof s.profiles?.[k]?.name==='string'&&Array.isArray(s.profiles[k].ways)&&Array.isArray(s.profiles[k].books)&&s.profiles[k].books.every(b=>typeof b.url==='string'&&b.url.startsWith('https://'))&&Array.isArray(s.artwork?.[k])&&s.artwork[k].every(c=>Array.isArray(c)&&c.slice(0,4).every(Number.isFinite)&&typeof c[4]==='string'))&&validStatus(s.status)&&object(s.artwork);
 }catch{return false;}
}
function stableLegacyId(raw,index){let hash=2166136261;for(const c of JSON.stringify(raw)){hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;}return `legacy-${index}-${hash.toString(16)}`;}
export function normalizeRecord(raw,index=0){
 const data=object(raw)?raw:{};
 const id=typeof data.id==='string'&&data.id?data.id:stableLegacyId(raw,index);
 const createdAt=data.createdAt||data.completedAt||data.timestamp||data.date||null;
 const version=String(data.version||data.testVersion||'未知版本');
 if(data.schemaVersion===1&&validSnapshot(data.snapshot))return {...data,id,createdAt,version,kind:'full'};
 // Partial/unknown old records remain present and readable; never reclassify them.
 const totals=data.totals||data.scores||data.result?.totals;
 const resultType=data.resultType||data.type||data.primary||data.result?.primary||'UNKNOWN';
 return {id,sessionId:data.sessionId,createdAt,version,kind:'legacy',resultType,title:typeof (data.title||data.name)==='string'?(data.title||data.name):String(resultType),totals:object(totals)?totals:null,percentages:data.percentages||null,answers:data.answers||null,raw};
}
const preserveIds=(raw,records)=>raw.map((r,i)=>object(r)?{...r,id:records[i].id}:{id:records[i].id,legacyValue:r});
export function readArchive(storage=globalThis.localStorage){
 const value=storage.getItem(ARCHIVE_KEY);if(value===null)return {raw:[],records:[]};
 let parsed;try{parsed=JSON.parse(value);}catch{throw new Error('存档数据暂时无法读取，原始记录已保留，未作覆盖。');}
 const raw=Array.isArray(parsed)?parsed:parsed?.schemaVersion===1&&Array.isArray(parsed.records)?parsed.records:null;
 if(!raw)throw new Error('存档格式暂不支持，原始记录已保留，未作覆盖。');
 return {raw,records:raw.map(normalizeRecord)};
}
export function createArchive({sessionId,createdAt,answers,questions,result,profiles,display,version=RELEASE}){
 if(!result.completed)throw new Error('请完成全部题目后再保存存档。');
 const status=systemStatus(result.totals);
 const usedProfiles=profiles;
 const record={schemaVersion:1,id:newId(),sessionId,createdAt:createdAt||new Date().toISOString(),version,resultType:display.types.join('+')||'UNKNOWN',totals:result.totals,percentages:Object.fromEntries(status.attributes.map(a=>[a.key,a.percent])),answers,snapshot:{result,questions,profiles:usedProfiles,display,status,artwork:Object.fromEntries(display.types.map(k=>[k,pixelArt(k)]))}};
 return copy(record);
}
export function writeArchive(record,storage=globalThis.localStorage){
 const {raw,records}=readArchive(storage);
 const existing=records.find(r=>r.id===record.id||(record.sessionId&&r.sessionId===record.sessionId));
 if(existing)return {record:existing,records,duplicate:true};
 if(!validSnapshot(record.snapshot))throw new Error('本次结果信息不完整，存档未保存。');
 const next=[record,...preserveIds(raw,records)];storage.setItem(ARCHIVE_KEY,JSON.stringify({schemaVersion:1,records:next}));
 return {record,records:next.map(normalizeRecord),duplicate:false};
}
export function deleteArchive(id,storage=globalThis.localStorage){
 const {raw,records}=readArchive(storage);
 const remaining=preserveIds(raw,records).filter((_,i)=>records[i].id!==id);
 storage.setItem(ARCHIVE_KEY,JSON.stringify({schemaVersion:1,records:remaining}));
 return remaining.map(normalizeRecord);
}
export function archiveTitle(record){return record.kind==='full'?record.snapshot.display.title:record.title;}
export function archiveArt(record){return record.kind==='full'?record.snapshot.display.art:types.has(record.resultType)?record.resultType:'unknown';}
export function archiveFilename(record){const date=new Date(record.createdAt);const stamp=Number.isNaN(date.getTime())?'UNDATED':`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}${String(date.getSeconds()).padStart(2,'0')}`;return `${record.resultType||'UNKNOWN'}_${stamp}_${record.id.slice(-6)}.sav`;}
export function formatDate(value){const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleString('zh-CN',{hour12:false}):'时间未记录';}
