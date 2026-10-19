import React from 'react';
import {t} from '../i18n/index.js';
import {EXPLORATION_DIRECTIONS, explorationDirections} from '../data/exploration.js';

export function ExplorationDirections({totals}: {totals: any}) {
 const {items, tiedCount, available} = explorationDirections(totals);
 if (!available) return null;
 return <section className="exploration-directions" aria-labelledby="exploration-title">
  <h2 id="exploration-title">{t('可以继续探索的方向')}</h2>
  {items.length > 0 && <ul>{items.map(key => {
   const [name, theme, hint] = EXPLORATION_DIRECTIONS[key];
   return <li key={key}><strong>{key} · {t(name)}</strong><span>{t(theme)}</span><p>{t(hint)}</p></li>;
  })}</ul>}
  {tiedCount > 0 && <p className="exploration-tie">{t(items.length ? '其后有 {count} 个方向原始分并列，暂不从中挑选展示。' : '有 {count} 个方向并列获得最高原始分，暂不从中挑选展示。', {count: String(tiedCount)})}</p>}
  <small>{t('这些只是本次答案中的探索线索，不代表稳定的人格，也不改变检测结果。')}</small>
 </section>;
}
