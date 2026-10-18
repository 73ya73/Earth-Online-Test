import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import questions from './data/questions.json';
import {SavesWindow,SaveComplete,LegacySave} from './components/SavesWindow';
import {newId,readArchive,writeArchive,createArchive,deleteArchive,RELEASE} from './utils/archives.js';
import {resultProfiles,presentation} from './data/profiles';
import {QuestionChoices} from './components/QuestionChoices';
import {calculate} from './scoring/engine.js';
import {restore,persist,clearProgress} from './utils/storage';
import {createCard} from './utils/art';
import './styles.css';
import './v11.css';
import './v12.css';
import './v13.css';
import './v15.css';
import {answerIds,toggleAnswer,complete} from './scoring/answers.js';
import {systemStatus} from './scoring/status.js';
import {DesktopShell} from './components/DesktopShell';
import {PixelIcon} from './components/PixelIcon';
import {Artwork} from './components/Artwork';
import {ResultProfile} from './components/ResultProfile';
function App(){
 const [initial]=useState(()=>restore(questions));const [page,setPage]=useState('welcome');const [answers,setAnswers]=useState<Record<string,string[]>>(initial?.answers||{});const [index,setIndex]=useState(initial?.index||0);const [notice,setNotice]=useState('');const [saving,setSaving]=useState(false);
 const [appActivation,setAppActivation]=useState(0);
 const [sessionId,setSessionId]=useState(()=>initial?.sessionId||newId());const [completedAt,setCompletedAt]=useState<string|null>(initial?.completedAt||null);
 const [archiveState,setArchiveState]=useState<any>(()=>{try{return {records:readArchive().records,error:''};}catch(e:any){return {records:[],error:e.message};}});const [savesState,setSavesState]=useState('closed');const [selectedArchive,setSelectedArchive]=useState<any>(null);const [saveComplete,setSaveComplete]=useState(false);
 const q=questions[index],currentResult=calculate(questions,answers),historical=page==='history'?selectedArchive:null,frozen=historical?.kind==='full'?historical.snapshot:undefined,result=frozen?.result||currentResult,display=frozen?.display||presentation(result);
 function openSaves(){try{setArchiveState({records:readArchive().records,error:''});}catch(e:any){setArchiveState((s:any)=>({...s,error:e.message}));}setSavesState('open');setSaveComplete(false);}
 function openHistory(record:any){setAppActivation(n=>n+1);setSelectedArchive(record);setSavesState('closed');setPage('history');}
 function removeSave(id:string){try{setArchiveState({records:deleteArchive(id),error:''});return true;}catch(e:any){setArchiveState((s:any)=>({...s,error:'删除失败：'+e.message}));setNotice('删除失败，原有记录未删除。');return false;}}
 function saveToArchive(){try{const record=createArchive({sessionId,createdAt:completedAt,answers,questions,result:currentResult,profiles:resultProfiles,display:presentation(currentResult)}),saved=writeArchive(record);setArchiveState({records:saved.records,error:''});if(saved.duplicate)setNotice('本次结果已存档，可在我的存档中查看。');else setSaveComplete(true);}catch(e:any){setNotice('存档失败：'+e.message);}}
 function start(){setAppActivation(n=>n+1);setAnswers({});setIndex(0);setSessionId(newId());setCompletedAt(null);setSelectedArchive(null);setSavesState('closed');setPage('quiz');}
 function finish(){if(!complete(questions,answers)){setIndex(questions.findIndex(question=>!answerIds(question,answers[question.questionId]).length));setNotice('请先完成所有题目。');return;}setCompletedAt(new Date().toISOString());setPage('loading');}
 useEffect(()=>{if(page==='quiz'||page==='result')persist(answers,index,page,{sessionId,completedAt});},[answers,index,page,sessionId,completedAt]);
 useEffect(()=>{if(page==='loading'){const t=setTimeout(()=>setPage('result'),700);return()=>clearTimeout(t);}},[page]);
 useEffect(()=>{window.scrollTo(0,0);document.getElementById('page-title')?.focus({preventScroll:true});},[page,index]);
 useEffect(()=>{if(notice){const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t);}},[notice]);
 function reset(){setAnswers({});setIndex(0);setPage('welcome');setSelectedArchive(null);setCompletedAt(null);setSessionId(newId());clearProgress();}
 async function save(){setSaving(true);try{const blob=await createCard(display.title,display.quote,display.art,frozen?.status||systemStatus(result.totals),{version:historical?.version||RELEASE,artwork:frozen?.artwork,createdAt:historical?.createdAt||completedAt||undefined});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='地球Online-回血人格.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);setNotice('结果图片已生成，手机可在下载中保存。');}catch{setNotice('图片保存失败，请重试。');}finally{setSaving(false);}}
 async function share(){const url=location.href.split('#')[0].split('?')[0];try{if(navigator.share){await navigator.share({title:'测测你的精神回血机制',text:'当地球 Online 开始疯狂掉血，你靠什么续命？',url});}else{await navigator.clipboard.writeText(url);setNotice('网站链接已复制，打开后进入欢迎页。');}}catch(e:any){if(e.name!=='AbortError')setNotice('分享失败，请复制地址栏中的网站链接。');}}
 return <DesktopShell appActivation={appActivation} onSaves={openSaves} savesState={savesState} onSavesState={setSavesState} extraWindows={<><SavesWindow state={savesState} records={archiveState.records} error={archiveState.error} onState={setSavesState} onOpen={openHistory} onDelete={removeSave} onStart={start}/>{saveComplete&&<SaveComplete onClose={()=>setSaveComplete(false)} onFolder={openSaves}/>}</>} page={page} hasProgress={Object.keys(answers).length>0} onHome={()=>setPage('welcome')} onResume={()=>{setSelectedArchive(null);setPage(complete(questions,answers)?'result':'quiz');}}><main>
 {page==='welcome'&&<section className="welcome"><aside className="wizard-sidebar"><div className="wizard-logo"><PixelIcon/><span className="pixel-spark">✦</span></div><div className="wizard-product">Earth Online<span>精神回血检测</span></div><div className="wizard-caption">PERSONAL RECHARGE<br/>SETUP WIZARD</div><div className="wizard-steps"><span className="current">01　欢迎使用</span><span>02　检测精神系统</span><span>03　生成用户档案</span></div><div className="wizard-version"><PixelIcon kind="battery"/><span>Recharge Edition<br/>Version 1.5</span></div></aside><div className="intro"><div className="eyebrow">WELCOME TO EARTH ONLINE</div><h1 id="page-title" tabIndex={-1}>测测你的精神回血机制</h1><p className="lead">当地球 Online 开始疯狂掉血，<br/>你的灵魂靠什么续命？</p><p className="muted">13 道题，解锁你的专属精神回血人格。</p><div className="setup-note"><PixelIcon kind="info"/><div><b>欢迎使用精神回血检测向导</b><p>跟随向导，找到适合你的补给方式。<br/>准备好后，请点击下方的 Start Setup。</p></div></div><div className="intro-meta"><span>13 题 · 含多选</span><span>约 3 分钟</span><span>无需注册</span></div><div className="setup-actions">{Object.keys(answers).length>0&&<button className="resume secondary" onClick={()=>setPage(complete(questions,answers)?'result':'quiz')}>继续上次的{complete(questions,answers)?'结果':'测试'}</button>}<button className="primary start" onClick={start}>Start Setup <span>开始测试 &gt;</span></button></div></div><div className="unknown-modules"><PixelIcon kind="disk"/><span>6 UNKNOWN MODULES DETECTED</span><small>完成检测后解锁你的回血档案</small></div></section>}
 {page==='quiz'&&<section className="quiz"><div className="quiz-banner"><PixelIcon kind="battery"/><div><strong>精神系统检测向导</strong><span>选择符合当前状态的答案，可返回修改。</span></div></div><div className="quiz-top"><span>检测进度</span><b>{String(index+1).padStart(2,'0')} <span>/ {questions.length}</span></b></div><div className="progress" role="progressbar" aria-valuenow={index+1} aria-valuemin={0} aria-valuemax={questions.length}><div style={{width:`${(index+1)/questions.length*100}%`}}/></div><h1 id="page-title" tabIndex={-1}>{q.text}</h1><QuestionChoices question={q} answer={answers[q.questionId]} onSelect={id=>{const next=toggleAnswer(q,answers[q.questionId],id);if(next.limited)setNotice(`本题最多选择 ${q.maxSelections} 项，请先取消一项。`);else setAnswers(a=>({...a,[q.questionId]:next.ids}));}}/><div className="navigation"><button className="secondary" onClick={()=>index?setIndex(index-1):setPage('welcome')}>← {index?'上一题':'返回'}</button><button className="primary" disabled={!answerIds(q,answers[q.questionId]).length} onClick={()=>index===questions.length-1?finish():setIndex(index+1)}>{index===questions.length-1?'查看我的回血人格':'下一题'} <span>→</span></button></div></section>}
 {page==='loading'&&<section className="loading"><Artwork type="unknown"/><h1 id="page-title" tabIndex={-1}>精神系统分析中……</h1><p>正在整理你的地球 Online 生存数据</p><div className="scan"/></section>}
 {(page==='result'||(page==='history'&&frozen))&&<ResultProfile key={historical?.id||sessionId} result={result} questions={frozen?.questions||questions} snapshot={frozen} historical={historical} onBackToSaves={openSaves} onArchive={historical?undefined:saveToArchive} archived={archiveState.records.some((r:any)=>r.sessionId===sessionId)} saving={saving} onSave={save} onShare={share} onReset={reset}/>}
 {page==='history'&&historical&&!frozen&&<LegacySave record={historical} onBack={openSaves} onReset={start}/>}
 </main><footer><span>EARTH ONLINE · Recharge Personality Test</span><span>趣味探索，非专业心理诊断。回答仅保存在当前浏览器。</span></footer><div className="toast" role="status" aria-live="polite">{notice}</div></DesktopShell>;
}
createRoot(document.getElementById('root')!).render(<App/>);
