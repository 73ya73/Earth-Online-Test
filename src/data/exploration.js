// Presentation hints only: use existing raw scores, never add scores or classify results.
export const EXPLORATION_DIRECTIONS = {
 ACT: ['正面开团', '行动与掌控感'],
 RESET: ['省电自救', '暂停与恢复'],
 SOCIAL: ['人类联机', '交流与支持'],
 LUCKY: ['赛博锦鲤', '仪式与希望感'],
 THINK: ['脑内推演', '思考与准备'],
 SAVE: ['人生存档', '回顾与意义感']
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
