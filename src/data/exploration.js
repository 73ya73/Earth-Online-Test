// Presentation hints only: use existing raw scores, never add scores or classify results.
export const EXPLORATION_DIRECTIONS = {
 ACT: ['正面开团', '行动与掌控感', '可以试着用一个小行动，探索行动与掌控感是否有助于你恢复状态。'],
 RESET: ['省电自救', '暂停与恢复', '可以给自己一次低负担的暂停，探索休息是否能带来恢复。'],
 SOCIAL: ['人类联机', '交流与支持', '可以尝试一次轻松的交流，留意连接与支持是否让你感觉好一些。'],
 LUCKY: ['赛博锦鲤', '仪式与希望感', '可以尝试一个小仪式，探索期待与希望感是否能给你一点补给。'],
 THINK: ['脑内推演', '思考与准备', '可以试着整理思路或做一点准备，留意思考是否帮助你更从容。'],
 SAVE: ['人生存档', '回顾与意义感', '可以回顾一段经历，探索记录与意义感是否能成为你的补给。']
};
export function explorationDirections(totals = {}) {
 const ranked = Object.keys(EXPLORATION_DIRECTIONS)
  .filter(key => Number.isFinite(totals[key]) && totals[key] > 0)
  .sort((a, b) => totals[b] - totals[a]);
 const items = [];
 let tiedCount = 0;
 for (let i = 0; i < ranked.length && items.length < 2;) {
  const group = ranked.filter(key => totals[key] === totals[ranked[i]]);
  if (items.length + group.length > 2) { tiedCount = group.length; break; }
  items.push(...group); i += group.length;
 }
 return {items, tiedCount, available: ranked.length > 0};
}
