import React from 'react';
import {t} from '../i18n/index.js';
import {EXPLORATION_DIRECTIONS, explorationDirections} from '../data/exploration.js';
import {explorationAdvice} from '../data/exploration-advice.js';

export function ExplorationDirections({totals}: {totals: any}) {
 const {items, tiedCount, available} = explorationDirections(totals);
 const advice = explorationAdvice(items);
 return <section className="exploration-directions" aria-labelledby="exploration-title">
  {available && <div className="recharge-clues"><h2 id="exploration-title">{t('你的回血线索')}</h2>
  {items.length > 0 && <ul>{items.map(key => {
   const [name, theme] = EXPLORATION_DIRECTIONS[key];
   return <li key={key}><strong>{key} · {t(name)}</strong><span>{t(theme)}</span></li>;
  })}</ul>}
  {tiedCount > 0 && <p className="exploration-tie">{t(items.length ? '其后有 {count} 个方向原始分并列，暂不从中挑选展示。' : '有 {count} 个方向并列获得最高原始分，暂不从中挑选展示。', {count: String(tiedCount)})}</p>}
  </div>}
  <div className="exploration-try"><h2 id={available ? undefined : 'exploration-title'}>{t('不妨试试')}</h2><p>{t(advice.body)}</p><small>{t(advice.observation)}</small></div>
 </section>;
}
