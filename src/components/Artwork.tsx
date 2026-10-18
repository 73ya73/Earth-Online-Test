import React,{useEffect,useRef} from 'react';
import {drawArt} from '../utils/art';
import {resultProfiles as personas} from '../data/profiles';
export function Artwork({type='unknown',large=false,commands,label:overrideLabel}:{type?:string;large?:boolean;commands?:Record<string,any[]>;label?:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=ref.current!.getContext('2d');if(c){c.clearRect(0,0,512,512);drawArt(c,type,0,0,512,commands);}},[type,commands]);
 const label=type.split('+').map(k=>personas[k]?`${personas[k].name}：${personas[k].artLabel}`:'待判定系统图标').join('、');
 return <canvas ref={ref} width="512" height="512" className={large?'art large':'art'} role="img" aria-label={overrideLabel||label}/>;
}
