import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import questions from './data/questions.json';
import {personas} from './data/personas';
import {calculate} from './scoring/engine.js';
import {restore,persist,STORAGE_KEY} from './utils/storage';
import {createCard} from './utils/art';
import './styles.css';
import './v11.css';
import './v12.css';
import {answerIds,toggleAnswer,complete} from './scoring/answers.js';
import {systemStatus} from './scoring/status.js';
import {DesktopShell} from './components/DesktopShell';
import {PixelIcon} from './components/PixelIcon';
import {Artwork} from './components/Artwork';
import {ResultProfile} from './components/ResultProfile';
function App(){
 const [initial]=useState(()=>restore(questions));const [page,setPage]=useState('welcome');const [answers,setAnswers]=useState<Record<string,string[]>>(initial?.answers||{});const [index,setIndex]=useState(initial?.index||0);const [notice,setNotice]=useState('');const [saving,setSaving]=useState(false);
 const q=questions[index];const result=calculate(questions,answers);const types=result.candidates.map((x:any)=>x.key);const p=types.length===1?personas[types[0]]:null;
 useEffect(()=>{if(page==='quiz'||page==='result')persist(answers,index,page);},[answers,index,page]);
 useEffect(()=>{if(page==='loading'){const t=setTimeout(()=>setPage('result'),700);return()=>clearTimeout(t);}},[page]);
 useEffect(()=>{window.scrollTo(0,0);document.getElementById('page-title')?.focus({preventScroll:true});},[page,index]);
 useEffect(()=>{if(notice){const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t);}},[notice]);
 function reset(){setAnswers({});setIndex(0);setPage('welcome');try{localStorage.removeItem(STORAGE_KEY);}catch{}}
 async function save(){setSaving(true);try{const blob=await createCard(p?.name|| (types.length?'多种补给，同时在线':'暂时无法判定'),p?.quote||(types.length?'你的精神系统，不只有一种补给方式。':'这次先不急着给自己贴标签。'),types.join('+')||'unknown',systemStatus(result.totals));const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='地球Online-回血人格.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);setNotice('结果图片已生成，手机可在下载中保存。');}catch{setNotice('图片保存失败，请重试。');}finally{setSaving(false);}}
 async function share(){const url=location.href.split('#')[0].split('?')[0];try{if(navigator.share){await navigator.share({title:'测测你的精神回血机制',text:'当地球 Online 开始疯狂掉血，你靠什么续命？',url});}else{await navigator.clipboard.writeText(url);setNotice('网站链接已复制，打开后进入欢迎页。');}}catch(e:any){if(e.name!=='AbortError')setNotice('分享失败，请复制地址栏中的网站链接。');}}
 return <DesktopShell page={page} hasProgress={Object.keys(answers).length>0} onHome={()=>setPage('welcome')} onResume={()=>setPage(complete(questions,answers)?'result':'quiz')}><main>
 {page==='welcome'&&<section className="welcome"><aside className="wizard-sidebar"><div className="wizard-logo"><PixelIcon/><span className="pixel-spark">✦</span></div><div className="wizard-product">Earth Online<span>精神回血检测</span></div><div className="wizard-caption">PERSONAL RECHARGE<br/>SETUP WIZARD</div><div className="wizard-steps"><span className="current">01　欢迎使用</span><span>02　检测精神系统</span><span>03　生成用户档案</span></div><div className="wizard-version"><PixelIcon kind="battery"/><span>Recharge Edition<br/>Version 1.2</span></div></aside><div className="intro"><div className="eyebrow">WELCOME TO EARTH ONLINE</div><h1 id="page-title" tabIndex={-1}>测测你的精神回血机制</h1><p className="lead">当地球 Online 开始疯狂掉血，<br/>你的灵魂靠什么续命？</p><p className="muted">13 道题，解锁你的专属精神回血人格。</p><div className="setup-note"><PixelIcon kind="info"/><div><b>欢迎使用精神回血检测向导</b><p>跟随向导，找到适合你的补给方式。<br/>准备好后，请点击下方的 Start Setup。</p></div></div><div className="intro-meta"><span>13 题 · 含多选</span><span>约 3 分钟</span><span>无需注册</span></div><div className="setup-actions">{Object.keys(answers).length>0&&<button className="resume secondary" onClick={()=>setPage(complete(questions,answers)?'result':'quiz')}>继续上次的{complete(questions,answers)?'结果':'测试'}</button>}<button className="primary start" onClick={()=>{setAnswers({});setIndex(0);setPage('quiz');}}>Start Setup <span>开始测试 &gt;</span></button></div></div><div className="unknown-modules"><PixelIcon kind="disk"/><span>6 UNKNOWN MODULES DETECTED</span><small>完成检测后解锁你的回血档案</small></div></section>}
 {page==='quiz'&&<section className="quiz"><div className="quiz-banner"><PixelIcon kind="battery"/><div><strong>精神系统检测向导</strong><span>{q.selectionMode==='multiple'?(q.questionId==='Q13'?'A–F 可多选；G 与其他选项互斥。':'最多选择 2 项，然后点击“下一题”。'):'选择最接近你的一个答案，然后点击“下一题”。'}</span></div></div><div className="quiz-top"><span>检测进度</span><b>{String(index+1).padStart(2,'0')} <span>/ {questions.length}</span></b></div><div className="progress" role="progressbar" aria-valuenow={index+1} aria-valuemin={0} aria-valuemax={questions.length}><div style={{width:`${(index+1)/questions.length*100}%`}}/></div><h1 id="page-title" tabIndex={-1}>{q.text}</h1><div className="options" role={q.selectionMode==='multiple'?'group':'radiogroup'} aria-label={q.text}>{q.options.map(o=><label key={o.optionId} className={`option ${answerIds(q,answers[q.questionId]).includes(o.optionId)?'selected':''}`}><input type={q.selectionMode==='multiple'?'checkbox':'radio'} name={q.questionId} value={o.optionId} checked={answerIds(q,answers[q.questionId]).includes(o.optionId)} onChange={()=>{const next=toggleAnswer(q,answers[q.questionId],o.optionId);if(next.limited)setNotice('本题最多选择 2 项，请先取消一项。');else setAnswers(a=>({...a,[q.questionId]:next.ids}));}}/><span className="letter">{o.optionId}</span><span>{o.text.slice(3)}</span><span className="check" aria-hidden="true">{answerIds(q,answers[q.questionId]).includes(o.optionId)?'✓':'○'}</span></label>)}</div><div className="navigation"><button className="secondary" onClick={()=>index?setIndex(index-1):setPage('welcome')}>← {index?'上一题':'返回'}</button><button className="primary" disabled={!answerIds(q,answers[q.questionId]).length} onClick={()=>index===questions.length-1?setPage('loading'):setIndex(index+1)}>{index===questions.length-1?'查看我的回血人格':'下一题'} <span>→</span></button></div></section>}
 {page==='loading'&&<section className="loading"><Artwork type="unknown"/><h1 id="page-title" tabIndex={-1}>精神系统分析中……</h1><p>正在整理你的地球 Online 生存数据</p><div className="scan"/></section>}
 {page==='result'&&<ResultProfile result={result} questions={questions} saving={saving} onSave={save} onShare={share} onReset={reset}/>}
 </main><footer><span>EARTH ONLINE · Recharge Personality Test</span><span>趣味探索，非专业心理诊断。回答仅保存在当前浏览器。</span></footer><div className="toast" role="status" aria-live="polite">{notice}</div></DesktopShell>;
}
createRoot(document.getElementById('root')!).render(<App/>);
