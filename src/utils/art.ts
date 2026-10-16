import {pixelArt} from '../data/pixel-art.js';
export function drawArt(ctx:CanvasRenderingContext2D,key:string,x:number,y:number,size:number){
 const keys=key.split('+').filter(Boolean);
 if(keys.length>1){const cols=keys.length===2?2:Math.ceil(Math.sqrt(keys.length));const cell=size/cols;const rows=Math.ceil(keys.length/cols);keys.forEach((k,i)=>drawArt(ctx,k,x+(i%cols)*cell,y+(size-rows*cell)/2+Math.floor(i/cols)*cell,cell));return;}
 const unit=Math.max(1,Math.floor(size/64));ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(x+(size-unit*64)/2),Math.round(y+(size-unit*64)/2));ctx.scale(unit,unit);
 for(const [px,py,w,h,color] of pixelArt(key)){ctx.fillStyle=color;ctx.fillRect(px,py,w,h);}ctx.restore();
}
export async function createCard(title:string,quote:string,key:string){
 await document.fonts.ready;const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;const c=canvas.getContext('2d')!;
 c.fillStyle='#76b7e6';c.fillRect(0,0,1080,1440);c.fillStyle='#ece9d8';c.fillRect(45,55,990,1330);c.strokeStyle='#0755d9';c.lineWidth=7;c.strokeRect(45,55,990,1330);
 const bar=c.createLinearGradient(0,55,0,123);bar.addColorStop(0,'#559eff');bar.addColorStop(.4,'#0662ef');bar.addColorStop(1,'#0049c5');c.fillStyle=bar;c.fillRect(45,55,990,68);
 c.fillStyle='#fff';c.font='bold 26px Tahoma, sans-serif';c.fillText('Earth Online — User Profile',75,99);c.fillStyle='#d65b39';c.fillRect(965,68,48,42);c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(965,68,48,42);c.fillStyle='#fff';c.font='32px Tahoma, sans-serif';c.fillText('×',979,101);
 c.fillStyle='#fff';c.fillRect(80,160,920,640);c.strokeStyle='#b8b7a9';c.lineWidth=2;c.strokeRect(80,160,920,640);drawArt(c,key,230,165,620);
 c.fillStyle='#214b82';c.font='bold 64px Tahoma, sans-serif';wrap(c,title,95,910,880,82);c.fillStyle='#4e647d';c.font='32px Tahoma, sans-serif';wrap(c,quote,95,1080,860,54);
 c.strokeStyle='#b8b4a5';c.beginPath();c.moveTo(80,1240);c.lineTo(1000,1240);c.stroke();c.fillStyle='#214b82';c.font='24px Tahoma, sans-serif';c.fillText('测测你的精神回血机制',95,1290);c.fillStyle='#777c72';c.font='19px Tahoma, sans-serif';c.fillText('趣味探索 · 试行规则待校准 · 非心理诊断',95,1335);
 return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图片生成失败')),'image/png'));
}
function wrap(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,height:number){let line='';for(const char of text){if(c.measureText(line+char).width>width){c.fillText(line,x,y);line='';y+=height;}line+=char;}c.fillText(line,x,y);}
