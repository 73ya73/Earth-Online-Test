import {KEYS} from './engine.js';
export const ATTRIBUTES={ACT:['行动力','Action'],RESET:['休整力','Recovery'],SOCIAL:['联机值','Social Link'],LUCKY:['好运值','Luck'],THINK:['推演值','Analysis'],SAVE:['存档值','Memory']};
export function systemStatus(totals={}){
 const values=KEYS.map(key=>({key,raw:Number.isFinite(totals[key])&&totals[key]>0?totals[key]:0}));
 const total=values.reduce((sum,x)=>sum+x.raw,0);
 const available=Number.isFinite(total)&&total>0;
 const attributes=values.map(x=>({...x,percent:available?Math.round(x.raw/total*1000)/10:0,label:ATTRIBUTES[x.key][0],english:ATTRIBUTES[x.key][1]}));
 const ranked=attributes.filter(x=>available&&x.raw>0).sort((a,b)=>b.raw-a.raw);
 const cutoff=ranked[2]?.raw??ranked.at(-1)?.raw??Infinity;
 const top=ranked.filter(x=>x.raw>=cutoff).map(x=>({...x,rank:1+ranked.filter(y=>y.raw>x.raw).length}));
 return {attributes,top,total:available?total:0,available};
}
