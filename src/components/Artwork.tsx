import React,{useEffect,useRef} from 'react';
import {drawArt} from '../utils/art';
import {personas} from '../data/personas';
export function Artwork({type='unknown',large=false}:{type?:string;large?:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=ref.current!.getContext('2d');if(c){c.clearRect(0,0,512,512);drawArt(c,type,0,0,512);}},[type]);
 const label=type.split('+').map(k=>personas[k]?`${personas[k].name}：${personas[k].artLabel}`:'待判定系统图标').join('、');
 return <canvas ref={ref} width="512" height="512" className={large?'art large':'art'} role="img" aria-label={label}/>;
}
