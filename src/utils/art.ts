export function drawArt(ctx:CanvasRenderingContext2D,key:string,x:number,y:number,size:number){
 ctx.save();ctx.translate(x,y);ctx.strokeStyle='#254f4b';ctx.fillStyle='#254f4b';ctx.lineWidth=size/90;
 const r=size*.35;ctx.translate(size/2,size/2);
 if(key==='ACT'){for(let i=0;i<5;i++){ctx.beginPath();let d=(i-2)*size*.11;ctx.moveTo(-r,d+r/2);ctx.lineTo(r,d-r/2);ctx.lineTo(r-size*.17,d-r/2);ctx.stroke();}}
 else if(key==='RESET'){for(let i=0;i<7;i++){ctx.beginPath();ctx.ellipse(0,(i-3)*size*.065,r-Math.abs(i-3)*size*.022,size*.075,0,0,Math.PI*2);ctx.stroke();}}
 else if(key==='SOCIAL'){for(let i=0;i<3;i++){let a=i*Math.PI*2/3;ctx.beginPath();ctx.arc(Math.cos(a)*r*.5,Math.sin(a)*r*.5,r*.7,0,Math.PI*2);ctx.stroke();}}
 else if(key==='LUCK'){for(let i=0;i<4;i++){let s=r*(1-i*.19);ctx.beginPath();ctx.moveTo(0,-s);ctx.quadraticCurveTo(s*.12,-s*.12,s,0);ctx.quadraticCurveTo(s*.12,s*.12,0,s);ctx.quadraticCurveTo(-s*.12,s*.12,-s,0);ctx.quadraticCurveTo(-s*.12,-s*.12,0,-s);ctx.stroke();}}
 else if(key==='THINK'){for(let i=0;i<6;i++){ctx.rotate(Math.PI/6);ctx.strokeRect(-r*.7,-r*.7,r*1.4,r*1.4);}}
 else if(key==='SAVE'){for(let i=0;i<5;i++){let d=i*size*.055;ctx.strokeRect(-r+d*.5,-r+d,r*1.7,r*1.25);}}
 else{for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(0,0,r*(i+1)/6,0,Math.PI*2);ctx.stroke();}}
 ctx.restore();
}
export async function createCard(title:string,quote:string,key:string){
 await document.fonts.ready;const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;const c=canvas.getContext('2d')!;
 c.fillStyle='#f5f4ed';c.fillRect(0,0,1080,1440);c.strokeStyle='#c8d0c7';c.strokeRect(55,55,970,1330);
 c.fillStyle='#254f4b';c.font='24px sans-serif';c.fillText('EARTH ONLINE / RECHARGE PROFILE',95,125);drawArt(c,key,230,190,620);
 c.font='bold 64px sans-serif';wrap(c,title,95,875,880,82);c.font='32px sans-serif';wrap(c,quote,95,1060,860,54);
 c.font='24px sans-serif';c.fillText('测测你的精神回血机制',95,1290);c.font='19px sans-serif';c.fillText('趣味探索 · 试行规则待校准 · 非心理诊断',95,1335);
 return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图片生成失败')),'image/png'));
}
function wrap(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,height:number){let line='';for(const char of text){if(c.measureText(line+char).width>width){c.fillText(line,x,y);line='';y+=height;}line+=char;}c.fillText(line,x,y);}
