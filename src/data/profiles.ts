import {t,localizeProfile} from '../i18n/index.js';
import { personas, type Persona } from './personas';
import exploring from './exploring.json';
export const resultProfiles: Record<string, Persona> = { ...personas, EXPLORING: exploring };
export const getProfiles=()=>Object.fromEntries(Object.entries(resultProfiles).map(([k,p])=>[k,localizeProfile(p)]));
export function presentation(result: any) {
    const types: string[] = result.status === 'exploring' ? ['EXPLORING'] : result.candidates.map((x: any) => x.key);
    const profiles=getProfiles();
    const profile = types.length === 1 ? profiles[types[0]] : null;
    const multiClues:Record<string,string>={ACT:'把问题变成小行动',RESET:'通过休整恢复电量',SOCIAL:'在连接中获得支持',LUCKY:'用小仪式保留希望',THINK:'用分析减少未知',SAVE:'在回顾中找到意义'};
    if(result.finalType==='MULTI')return {types,profile:null,title:t('多重补给型'),quote:t('本次主要机制：{v0}。这些方式各有独立线索支持，可以随情境选择，不代表能力更强。',{v0:types.map(k=>profiles[k].name).join(' / ')}),art:types.join('+'),explanation:t('你可以在{v0}之间切换，让不同补给方式对应不同情境。',{v0:types.map(k=>t(multiClues[k])).join(' / ')})};
    return { types, profile, title: profile?.name || (types.length ? t("多种补给，同时在线") : t("尚未完成检测")), quote: profile?.quote || (types.length ? t("你的精神系统，不只有一种补给方式。") : t("完成答题后，查看你的回血线索。")), art: types.join('+') || 'unknown' };
}
