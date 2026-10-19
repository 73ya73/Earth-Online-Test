import React,{useEffect,useState} from 'react';

// Loaded by a DEV-only dynamic import. No payload/answer data is rendered.
export function ResearchDebugPanel({queue}:{queue:any}){
 const [state,setState]=useState(()=>queue.summary());
 useEffect(()=>{const update=()=>setState(queue.summary());const unsubscribe=queue.subscribe(update);update();return unsubscribe;},[queue]);
 const last=state.last;
 return <aside data-research-debug="true" aria-label="上传队列开发面板" style={{position:'fixed',right:8,bottom:44,zIndex:10000,maxWidth:'calc(100vw - 16px)',padding:'8px 12px',background:'#ece9d8',border:'2px solid #245edb',font:'12px Tahoma, sans-serif',color:'#111',pointerEvents:'none'}}>
  <strong>Research Upload · DEV ONLY</strong>
  <div>pending: {state.pending} · failed: {state.failed}</div>
  <div>最近状态：{last?.status||'—'} · HTTP：{last?.http_status??'—'}</div>
  <div>错误类别：{last?.error_category||'—'}</div>
  <div>轮次：{last?.round??'—'}/3 · 本轮：{last?.attempts??0}/3 · 累计：{last?.total_attempts??0}/9</div>
 </aside>;
}
