import {personas, type Persona} from './personas';
import exploring from './exploring.json';
export const resultProfiles:Record<string,Persona>={...personas,EXPLORING:exploring};
export function presentation(result:any){
 const types:string[]=result.status==='exploring'?['EXPLORING']:result.candidates.map((x:any)=>x.key);
 const profile=types.length===1?resultProfiles[types[0]]:null;
 return {types,profile,title:profile?.name||(types.length?'多种补给，同时在线':'尚未完成检测'),quote:profile?.quote||(types.length?'你的精神系统，不只有一种补给方式。':'完成答题后，查看你的回血线索。'),art:types.join('+')||'unknown'};
}
