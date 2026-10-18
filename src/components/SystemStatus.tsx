import React from 'react';
import {systemStatus} from '../scoring/status.js';
export function SystemStatus({totals,insufficient}:{totals:any;insufficient:boolean}){
 const status=systemStatus(totals);
 return <section className="system-status" aria-labelledby="status-title"><div className="status-heading"><h2 id="status-title">System Status <span>游戏状态</span></h2><small>RAW SCORE SHARE</small></div><div className="attribute-list">{status.attributes.map(a=><div className="attribute-row" key={a.key}><span><b>{a.key}</b> {a.label}<small>{a.english}</small></span><div className="attribute-track" role="meter" aria-label={a.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={a.percent}><i style={{width:`${a.percent}%`}}/></div><output>{a.percent}%</output></div>)}</div><div className="top-attributes"><strong>TOP 3</strong>{status.top.length?status.top.map(a=><span key={a.key}>#{a.rank} {a.label} <b>{a.percent}%</b></span>):<span>暂无正分属性</span>}</div><p className="status-note">{!status.available?'暂无可计算得分，六项暂显示 0%。':insufficient?'已有分数可展示占比，但独立题目证据不足，暂不判定人格。':'占比 = 本项原始分 ÷ 六维总分；不是人格判定值或心理准确率。'}{status.top.length>3?' 第三名并列均保留。':''}</p></section>;
}
