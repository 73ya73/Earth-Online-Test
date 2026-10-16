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
 c.fillStyle='#76b7e6';c.fillRect(0,0,1080,1440);c.fillStyle='#ece9d8';c.fillRect(45,55,990,1330);c.strokeStyle='#0755d9';c.lineWidth=7;c.strokeRect(45,55,990,1330);
 const bar=c.createLinearGradient(0,55,0,123);bar.addColorStop(0,'#559eff');bar.addColorStop(.4,'#0662ef');bar.addColorStop(1,'#0049c5');c.fillStyle=bar;c.fillRect(45,55,990,68);
 c.fillStyle='#fff';c.font='bold 26px Tahoma, sans-serif';c.fillText('Earth Online — User Profile',75,99);c.fillStyle='#d65b39';c.fillRect(965,68,48,42);c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(965,68,48,42);c.fillStyle='#fff';c.font='32px Tahoma, sans-serif';c.fillText('×',979,101);
 c.fillStyle='#fff';c.fillRect(80,160,920,640);c.strokeStyle='#b8b7a9';c.lineWidth=2;c.strokeRect(80,160,920,640);drawArt(c,key,230,165,620);
 c.fillStyle='#214b82';c.font='bold 64px Tahoma, sans-serif';wrap(c,title,95,910,880,82);c.fillStyle='#4e647d';c.font='32px Tahoma, sans-serif';wrap(c,quote,95,1080,860,54);
 c.strokeStyle='#b8b4a5';c.beginPath();c.moveTo(80,1240);c.lineTo(1000,1240);c.stroke();c.fillStyle='#214b82';c.font='24px Tahoma, sans-serif';c.fillText('测测你的精神回血机制',95,1290);c.fillStyle='#777c72';c.font='19px Tahoma, sans-serif';c.fillText('趣味探索 · 试行规则待校准 · 非心理诊断',95,1335);
 return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图片生成失败')),'image/png'));
}
function wrap(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,height:number){let line='';for(const char of text){if(c.measureText(line+char).width>width){c.fillText(line,x,y);line='';y+=height;}line+=char;}c.fillText(line,x,y);}
