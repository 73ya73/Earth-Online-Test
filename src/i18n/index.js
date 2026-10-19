import catalog from './en-ui.json' with {type:'json'};
import englishQuestions from './en-questions.json' with {type:'json'};
export const LOCALE_KEY='earth-recharge-locale';
let locale='zh';try{if(globalThis.localStorage?.getItem(LOCALE_KEY)==='en')locale='en';}catch{}
const listeners=new Set();
export const getLocale=()=>locale;
export function setLocale(value){
 if(!['zh','en'].includes(value)||value===locale)return;
 locale=value;try{globalThis.localStorage?.setItem(LOCALE_KEY,value);}catch{}
 if(globalThis.document){document.documentElement.lang=value==='en'?'en':'zh-CN';document.title=t('测测你的精神回血机制')+' · Earth Online';}
 for(const listener of listeners)listener();
}
export function subscribeLocale(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
export function t(key,values={},language=locale){
 const text=language==='en'?(catalog[key]??key):key;
 return text.replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(values,name)?String(values[name]):match);
}
export function localizeQuestions(questions,language=locale){
 if(language!=='en')return questions;
 return questions.map(q=>{
  const en=englishQuestions[q.questionId];
  if(!en||q.options.some(o=>!en.options[o.optionId]))throw Error('Missing official translation: '+q.questionId);
  return {...q,text:en.text,options:q.options.map(o=>({...o,text:en.options[o.optionId]}))};
 });
}
export function localizeProfile(profile){
 return {...profile,...Object.fromEntries(['name','quote','description','systemMessage','rechargeTip','artLabel'].map(k=>[k,t(profile[k])])),ways:profile.ways.map(s=>t(s)),books:profile.books.map(b=>({...b,title:t(b.title),reason:t(b.reason)}))};
}
