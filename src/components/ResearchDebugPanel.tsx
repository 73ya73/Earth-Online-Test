import {getLocale,subscribeLocale} from '../i18n/index.js';
import React,{useEffect,useState} from 'react';
import devCatalog from '../i18n/dev-ui.json';
const t=(text:string)=>getLocale()==='en'?((devCatalog as Record<string,string>)[text]||text):text;

// Loaded by a DEV-only dynamic import. No payload/answer data is rendered.
export function ResearchDebugPanel({queue}:{queue:any}){
 const [state,setState]=useState(()=>queue.summary());
 useEffect(()=>{const update=()=>setState(queue.summary());const unsubscribe=queue.subscribe(update);const stopLocale=subscribeLocale(update);update();return ()=>{unsubscribe();stopLocale();};},[queue]);
 const last=state.last;
 return <aside data-research-debug="true" aria-label={t('上传队列开发面板')} style={{position:'fixed',right:8,bottom:44,zIndex:10000,maxWidth:'calc(100vw - 16px)',padding:'8px 12px',background:'#ece9d8',border:'2px solid #245edb',font:'12px Tahoma, sans-serif',color:'#111',pointerEvents:'none'}}>
  <strong>Research Upload · DEV ONLY</strong>
  <div>pending: {state.pending} · failed: {state.failed}</div>
  <div>{t('最近状态：')}{last?.status||'—'} · HTTP：{last?.http_status??'—'}</div>
  <div>{t('错误类别：')}{last?.error_category||'—'}</div>
  <div>{t('轮次：')}{last?.round??'—'}/3 · {t('本轮：')}{last?.attempts??0}/3 · {t('累计：')}{last?.total_attempts??0}/9</div>
 </aside>;
}
