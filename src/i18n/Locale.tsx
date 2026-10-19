import React,{useSyncExternalStore} from 'react';
import {getLocale,setLocale,subscribeLocale} from './index.js';
export const useLocale=()=>useSyncExternalStore(subscribeLocale,getLocale,getLocale);
export function LanguageSwitch(){
 const locale=useLocale();
 return <div className="language-switch" role="group" aria-label={locale==='en'?'Language':'语言'}>
  <button type="button" lang="zh-CN" aria-pressed={locale==='zh'} onClick={()=>setLocale('zh')}>中文</button>
  <span aria-hidden="true">/</span>
  <button type="button" lang="en" aria-pressed={locale==='en'} onClick={()=>setLocale('en')}>EN</button>
 </div>;
}
