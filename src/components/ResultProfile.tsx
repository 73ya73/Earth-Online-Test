import {t} from '../i18n/index.js';
import React, { useRef, useState } from 'react';
import { resultProfiles, getProfiles, presentation } from '../data/profiles';
import { formatDate } from '../utils/archives.js';
import { KEYS } from '../scoring/engine.js';
import { Artwork } from './Artwork';
import { SystemStatus } from './SystemStatus';
import { PixelIcon } from './PixelIcon';
import { ExplorationDirections } from './ExplorationDirections';

export function ResultProfile({ result, questions, saving, onSave, onShare, onReset, onArchive, archived = false, snapshot, historical, onBackToSaves }: {
    result: any;
    questions: any[];
    saving: boolean;
    onSave: () => void;
    onShare: () => void;
    onReset: () => void;
    onArchive?: () => void;
    archived?: boolean;
    snapshot?: any;
    historical?: {
        createdAt: string;
        version: string;
    };
    onBackToSaves?: () => void;
}) {
const tabs = [['general', t("常规"), 'General'], ['history', t("回答线索与记录"), 'Answer History'], ['reading', t("推荐阅读"), 'Reading'], ['scoring', t("计分说明"), 'Scoring Info']];
    const [tab, setTab] = useState('general');
    const [expanded, setExpanded] = useState(false);
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    const personas = snapshot?.profiles || getProfiles();
    const display = snapshot?.display || presentation(result), types = display.types, p = snapshot && types.length === 1 ? personas[types[0]] : display.profile;
    const exploring = result.status === 'exploring';
    const insufficient = result.status === 'insufficient';
    const undetermined = insufficient || exploring;
    const reason = result.algorithm_version&&exploring?t('本次答案尚不足以支持明确的主导机制。百分比只描述相对分数，不是确定人格。'):result.reason === 'all-zero' ? t("本次已选答案没有贡献任何已配置的数字分数，暂时没有人格得分可供比较。完整作答时 Q4 必定提供分数；你可以重新测试，或在计分说明中查看本次记录。") : t("本次有明确得分，但没有机制获得至少两道不同题目的正分支持。单个回答不足以稳定判断主要回血方式，因此暂不指定人格。");
    function move(e: React.KeyboardEvent, i: number) { let next = i; if (e.key === 'ArrowRight')
        next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft')
        next = (i + tabs.length - 1) % tabs.length;
    else if (e.key === 'Home')
        next = 0;
    else if (e.key === 'End')
        next = tabs.length - 1;
    else
        return; e.preventDefault(); setTab(tabs[next][0]); buttons.current[next]?.focus(); }
    return <section className={`results${exploring && !snapshot ? ' results-exploring' : ''}`}>{historical && <div className="historical-banner"><strong>{t("Historical Save · 历史存档")}</strong><span>{formatDate(historical.createdAt)} · v{historical.version}</span><p>{t("这是你在那一天留下的精神回血记录。")}</p></div>}<div className="profile-heading"><PixelIcon /><div><h2>User Profile</h2><span>{t("地球 Online · 精神系统属性 v")}{historical?.version || '1.7'}</span></div><span className="profile-stamp">{exploring ? 'EXPLORING' : insufficient ? t("检测进行中") : t("检测完成")}</span></div>
 <div className="archive-profilebar">{historical ? <button className="secondary" onClick={onBackToSaves}>{t("← 返回我的存档")}</button> : onArchive && <button className="primary" onClick={onArchive}><PixelIcon kind="disk"/>{archived ? t("已保存到我的存档") : t("保存到我的存档")}</button>}<small>{historical ? t("历史存档只读 · 使用当时的结果快照") : t("本地存档仅保存在当前浏览器中。")}</small></div>
 <div className="profile-tabs" role="tablist" aria-label={t("用户属性导航")}>{tabs.map(([id, label, en], i) => <button key={id} ref={el => { buttons.current[i] = el; }} id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={e => move(e, i)}>{label}<small>{en}</small></button>)}</div>
 <section className="profile-panel" id="panel-general" role="tabpanel" aria-labelledby="tab-general" hidden={tab !== 'general'}>
 <div className="result-hero" id="profile-general"><div><span className="result-kicker">{exploring ? 'RECHARGE MODE: EXPLORING' : result.status === 'single' ? t("你的主要回血机制") : insufficient ? t("检测尚未完成") : t("你的回血机制组合")}</span><h1 id="page-title" tabIndex={-1}>{display.title}</h1><p className="quote">{display.quote}</p>{exploring && !snapshot && <p className="exploration-body">{p?.description}</p>}<span className="pilot">{t("趣味探索 · 非心理诊断")}</span></div><Artwork type={display.art} large commands={snapshot?.artwork} label={snapshot ? (p?.artLabel || display.title) : undefined}/></div>
 {exploring && !snapshot && <ExplorationDirections totals={result.totals}/> }
 <SystemStatus totals={result.totals} insufficient={undetermined} snapshotStatus={snapshot?.status} candidate={!!result.algorithm_version}/>
 <div className="result-actions"><button className="primary" disabled={saving} onClick={onSave}>{saving ? t("生成图片中…") : t("保存结果图片")} ↓</button><button className="secondary" onClick={onReset}>{t("重新测试 ↻")}</button><button className="secondary" aria-expanded={expanded} aria-controls="detailed-analysis" onClick={() => setExpanded(!expanded)}>{expanded ? t("收起详细分析") : t("查看详细分析")} {expanded ? '−' : '+'}</button><button className="secondary" onClick={onShare}>{t("分享 / 复制链接 ↗")}</button></div>
 <details className="detailed-analysis" id="detailed-analysis" open={expanded} onToggle={e => setExpanded(e.currentTarget.open)}><summary>{t("详细分析 · 系统鼓励与回血建议")}</summary><div className="analysis-intro"><p>{p?.description || (insufficient ? reason : result.finalType==='MULTI'?(display.explanation||display.quote):result.status === 'tie' ? t("这些机制的归一化比较值完全并列，因此共同展示，不用固定顺序或随机数替你决定人格。") : t("领先机制的比较值相差不超过 0.1。当前试行规则将接近的机制共同展示，帮助你探索不同补给方式。"))}</p></div>
 {!insufficient && <div className="persona-support-grid">{types.map(key => <article className="result-block persona-support" key={key} data-persona={key}><div className="persona-support-heading"><Artwork type={key} commands={snapshot?.artwork} label={t(personas[key].artLabel)}/><div><small>{key}</small><h2>{t(personas[key].name)}</h2></div></div>{!p && <p>{t(personas[key].description)}</p>}<div className="system-message"><h3>{t("System Message · 系统鼓励")}</h3><p>{t(personas[key].systemMessage)}</p></div><div className="recharge-tip"><h3>{t("Recharge Tip · 回血建议")}</h3><p>{t(personas[key].rechargeTip)}</p></div><details className="more-ways"><summary>{t("更多常见回血方式")}</summary><ul>{personas[key].ways.map(w => <li key={w}>{t(w)}</li>)}</ul></details></article>)}</div>}
 {undetermined && <div className="insufficient-actions"><PixelIcon kind="info"/><p>{exploring ? t("探索状态记录的是当前线索，不是测试失败，也不增加第七个得分维度。") : t("完成全部题目后，再一起查看回血线索。")}</p><button className="secondary" onClick={() => setTab('scoring')}>{t("查看得分与原因")}</button></div>}
 </details>
 </section>
 <section className="profile-panel" id="panel-history" role="tabpanel" aria-labelledby="tab-history" hidden={tab !== 'history'}>
 <article className="result-block tendencies" id="profile-signals"><small>YOUR SELECTED SIGNALS</small><h2>{t("你的回答里，还有这些线索")}</h2><p>{t("这些是本次选择的片段，不代表固定的心理特质。")}</p><div className="tags">{Object.entries(result.behavioralProfile).map(([tag, count]) => <span key={tag}>{t(tag).replace(/^T\d+\s*/, '')} · {String(count)}{t("次")}</span>)}</div><div className="context">{result.contextProfile.filter((o: any) => o.questionId === 'Q2' || o.questionId === 'Q3').map((o: any) => <p key={o.questionId}>{o.questionId === 'Q2' ? t("当前副本") : t("最近状态")}：{o.text.slice(3)}</p>)}</div></article>
 <div className="history-heading"><PixelIcon kind="folder"/><div><h2>Answer History</h2><p>{t("以下记录仅保存在当前浏览器，分享链接不会包含这些答案。")}</p></div></div><ol className="answer-history">{questions.map(q => { const selected = result.selections.filter((o: any) => o.questionId === q.questionId); return <li key={q.questionId}><h3>{q.text}</h3>{selected.length ? selected.map((o: any) => <p key={o.optionId}>{o.text}</p>) : <p>{t("本题未作答")}</p>}</li>; })}</ol>
 </section>
 <section className="profile-panel" id="panel-reading" role="tabpanel" aria-labelledby="tab-reading" hidden={tab !== 'reading'}>
 <div className="reading-heading"><PixelIcon kind="folder"/><div><h2>Recommended Reading.exe</h2><p>{t("按本次回血机制挑选的延伸阅读。可以先借阅或浏览介绍，阅读无需变成新的任务。")}</p></div></div>
 {types.length ? types.map(key => <section className="reading-group" key={key}><h3>{key} · {t(personas[key].name)}</h3><div className="reading-grid">{personas[key].books.map((book, i) => <article className="book-card" key={t(book.title)}><div className="book-cover" aria-hidden="true"><span>READ<br />ME</span><b>{String(i + 1).padStart(2, '0')}</b></div><div><h4>{t(book.title)}</h4><p className="book-author">{book.author}</p><p>{t(book.reason)}</p><a href={book.url} target="_blank" rel="noopener noreferrer">{t("查看作者 / 出版社介绍 ↗")}</a></div></article>)}</div></section>) : <p className="empty-reading">{t("本次暂未形成候选人格，因此不按人格分配书单。可以先查看得分原因，或重新测试后再探索阅读。")}</p>}
 <p className="reading-note">{t("书名与作者已按作者或出版社官网核实；人格与书籍的匹配理由由本项目编写，仅供阅读探索，不作为治疗建议。")}</p>
 </section>
 <section className="profile-panel" id="panel-scoring" role="tabpanel" aria-labelledby="tab-scoring" hidden={tab !== 'scoring'}>
 <div className="scoring-heading"><PixelIcon kind="info"/><div><h2>Scoring Info</h2><p>{result.algorithm_version?t('八种结果：六种基础人格 + MULTI + EXPLORING；均不增加计分维度。'):t("六种计分机制与一个不计分的探索状态（文档 REST/LUCK 对应 RESET/LUCKY）；下列数字是本题库的比较依据，不是心理准确率。")}</p></div></div>
 {result.algorithm_version&&<div className="candidate-rules"><p>{t('八种结果：六种基础人格 + MULTI + EXPLORING；均不增加计分维度。')}</p><p>{t('候选规则：最高原始分至少 3，每个候选至少两道正分证据；差距不超过 1 的充分证据机制共同显示为 MULTI。')}</p><p>{t('这套原始分规则仍待确认，不是当前正式判定规则。')}</p></div>}<p className="score-status">{result.finalType==='MULTI'?display.quote:undetermined ? reason : result.status === 'tie' ? t("最高比较值完全并列，保留所有并列候选；不额外加入仅仅接近的较低候选。") : result.status === 'mixed' ? t("存在多个接近的候选，因此共同展示，不强行确定唯一人格。") : t("本次有一个候选在待校准规则下明确领先。")}</p>
 {historical && <details className="historical-config"><summary>{t("当次计分配置（v")}{historical.version}）</summary><pre>{JSON.stringify(result.config, null, 2)}</pre><p>{t("以下分数、证据题及回答均来自当时的快照，未使用当前题库重新计算。")}</p></details>}
 <table className="score-table-v11"><caption>{t("六种机制的原始得分、题库上限与独立题目证据")}</caption><thead><tr><th scope="col">{t("机制")}</th><th scope="col">{t("原始分 / 上限")}</th><th scope="col">{t("证据题")}</th><th scope="col">{result.algorithm_version?t("距最高原始分"):t("比较值")}</th></tr></thead><tbody>{KEYS.map(key => <tr key={key}><th scope="row">{key}<small>{t((personas[key] || resultProfiles[key]).name)}</small></th><td>{result.totals[key]} / {result.theory[key].max}</td><td>{result.evidence[key]}</td><td>{result.algorithm_version?Math.max(...Object.values(result.totals).map(Number))-Number(result.totals[key]):(result.theory[key].max ? result.totals[key] / result.theory[key].max : 0).toFixed(3)}</td></tr>)}</tbody></table>
 <details hidden={!!result.algorithm_version} className="rule-detail" id="profile-rules" open><summary>{t("这份结果是怎么来的？")}</summary><p>{t("只累加 Excel F–K 列中明确填写的数字；只有“参与评分”的题目影响得分。空白保留为未定义，不从答案字母或行为标签推导分数。比较值 = 原始得分 ÷ 该机制理论最高分。")}</p><p>{t("每种机制至少需两道不同题目的正分证据，才能进入候选。最高比较值完全并列时，共同展示所有最高候选；唯一最高但与其他候选的差距不超过 0.1 时，展示混合倾向。精度容差为 10⁻⁹；不使用随机数，也不默认返回 ACT。")}</p><p>{t("两题门槛、归一化和 0.1 差距沿用可配置的试行方案，尚未经过用户研究校准。Q9-D「独处一段时间」按 Excel 计入 THINK = 2，Q9-F「分析解决方法」计入 ACT = 2。Q9 的各选项分别加分，同题对同机制只计一道证据。Q10、Q13 不参与人格评分。新表将 Q10-E/F 分别标记为 T13 无明显变化、T14 负向体验，不参与计分。完整作答时 Q4 必定产生正分；完整作答但没有机制获得至少两道正分证据时，展示 EXPLORING 探索状态；不新增得分维度。正常最高并列、近似候选仍共同展示，不改判为探索状态。")}</p></details>
 </section>
 <div className="result-actions secondary-actions" hidden={tab === 'general'}><button className="primary" disabled={saving} onClick={onSave}>{saving ? t("生成图片中…") : t("保存结果图片")} ↓</button><button className="secondary" onClick={onShare}>{t("分享 / 复制链接 ↗")}</button><button className="text-button" onClick={onReset}>{t("重新测试 ↻")}</button></div>
 </section>;
}
