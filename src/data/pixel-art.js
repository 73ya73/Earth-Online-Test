// Original 64 × 64 pixel artwork. Commands are shared by profile canvases and PNG export.
export const ART_KEYS=['ACT','RESET','SOCIAL','LUCKY','THINK','SAVE'];
const C={ink:'#25466f',edge:'#8aa6c4',white:'#fffdf3',silver:'#cbd8e0',light:'#e7f4ff',blue:'#547bc7',cyan:'#89d4ee',green:'#68ad58',mint:'#b8e58a',gold:'#f2c568',orange:'#e9944e',pink:'#e985a2'};
export function pixelArt(key){
 const p=[];const r=(x,y,w,h,color)=>p.push([x,y,w,h,color]);
 function shape(points,color){const ys=points.map(v=>v[1]);for(let y=Math.min(...ys);y<Math.max(...ys);y++){const xs=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y+.5&&b[1]>y+.5)||(b[1]<=y+.5&&a[1]>y+.5))xs.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i<xs.length;i+=2){const x=Math.ceil(xs[i]-.5),end=Math.ceil(xs[i+1]-.5);if(end>x)r(x,y,end-x,1,color);}}}
 function star(x,y){shape([[x,y-7],[x+2,y-2],[x+7,y-2],[x+3,y+1],[x+4,y+7],[x,y+4],[x-5,y+7],[x-3,y+1],[x-7,y-2],[x-2,y-2]],C.ink);shape([[x,y-5],[x+1,y-1],[x+5,y-1],[x+2,y+1],[x+3,y+5],[x,y+3],[x-3,y+5],[x-2,y+1],[x-5,y-1],[x-1,y-1]],C.gold);r(x-1,y-2,2,3,'#fff1a6');}
 function monitor(x,y){r(x,y,21,17,C.ink);r(x+1,y+1,19,15,C.silver);r(x+2,y+1,17,1,C.white);r(x+3,y+3,15,10,C.blue);r(x+4,y+4,13,8,C.cyan);r(x+4,y+4,13,2,'#c1f3f5');r(x+4,y+10,6,2,C.mint);r(x+10,y+8,7,4,C.green);r(x+8,y+17,5,4,C.ink);r(x+5,y+21,11,2,C.ink);r(x+6,y+21,9,1,C.silver);r(x+16,y+14,2,1,C.edge);}
 r(8,5,48,1,'#fff');r(5,8,54,46,'#dbeafa');r(8,6,48,2,'#eaf5ff');r(6,8,2,44,'#fff');r(56,8,2,44,'#c5d8ef');r(8,54,48,2,'#a6c0df');r(13,56,39,2,'#9bb6d1');
 if(key==='ACT'){
  shape([[10,22],[21,18],[33,22],[33,39],[29,46],[21,52],[13,46],[10,39]],C.ink);shape([[12,24],[21,21],[31,24],[31,39],[27,45],[21,49],[15,44],[12,38]],C.blue);shape([[13,25],[21,23],[21,46],[16,43],[13,37]],'#96b9e8');r(20,27,3,16,C.gold);r(16,31,11,3,C.gold);r(20,27,1,16,'#fff0a7');
  shape([[27,40],[46,14],[55,9],[54,19],[33,46]],C.ink);shape([[30,39],[47,16],[52,13],[51,19],[33,42]],C.silver);shape([[30,39],[47,16],[52,13],[32,42]],C.white);shape([[25,35],[40,46],[37,50],[22,39]],C.ink);shape([[25,37],[38,46],[37,48],[24,39]],C.gold);shape([[25,41],[29,44],[22,53],[18,50]],C.ink);shape([[25,44],[27,45],[22,51],[21,50]],'#b78956');
 }else if(key==='RESET'){
  r(15,12,32,18,C.ink);r(47,17,3,8,C.ink);r(16,13,30,16,C.silver);r(18,15,26,12,C.white);for(let i=0;i<3;i++){r(19+i*8,16,6,10,C.green);r(19+i*8,16,6,3,C.mint);}r(10,35,4,19,C.ink);r(14,39,40,12,C.ink);r(51,35,4,19,C.ink);r(14,37,37,3,C.silver);r(15,40,35,9,C.white);r(17,40,10,4,'#dce9e9');r(29,40,21,9,C.blue);r(29,40,21,2,'#9ebfe6');r(14,49,37,2,C.silver);r(11,35,2,4,C.orange);
 }else if(key==='SOCIAL'){
  r(17,48,2,6,C.edge);r(17,53,29,2,C.edge);r(44,48,2,6,C.edge);r(29,51,5,5,C.ink);r(30,52,3,3,C.mint);monitor(8,26);monitor(35,26);
  shape([[24,10],[29,10],[32,13],[35,10],[40,10],[42,12],[42,17],[32,26],[22,17],[22,12]],C.ink);shape([[24,12],[28,12],[32,16],[36,12],[39,12],[40,14],[40,17],[32,23],[24,17]],C.pink);r(25,13,3,2,'#ffd2df');
 }else if(key==='LUCKY'){
  shape([[23,25],[26,29],[23,35],[19,39],[17,36],[22,30]],C.ink);shape([[23,26],[24,29],[21,34],[18,37],[22,30]],C.green);
  const leaves=[[[22,24],[13,24],[10,20],[10,15],[14,12],[18,12],[22,17]],[[24,23],[24,15],[28,10],[34,10],[38,14],[37,19],[31,24]],[[24,25],[31,24],[36,27],[36,32],[32,36],[27,34]],[[22,26],[19,33],[13,35],[9,32],[8,28],[12,24]]];
  for(const l of leaves)shape(l,C.ink);for(const l of leaves)shape(l.map(([x,y])=>[Math.round((x-23)*.78+23),Math.round((y-24)*.78+24)]),C.green);r(14,15,3,3,C.mint);r(29,13,3,3,C.mint);r(28,28,3,3,C.mint);r(12,28,3,2,C.mint);
  shape([[30,39],[34,33],[43,31],[49,34],[54,30],[58,30],[56,39],[59,47],[55,48],[49,43],[41,47],[34,46]],C.ink);shape([[32,39],[36,35],[43,33],[49,37],[54,33],[55,33],[53,39],[56,45],[54,45],[49,41],[41,45],[35,43]],C.orange);shape([[34,39],[38,35],[43,35],[40,40],[44,43],[40,44],[35,42]],C.white);r(35,37,2,2,C.ink);r(35,37,1,1,C.white);r(46,37,3,4,'#fbdba0');r(28,50,12,1,C.cyan);r(42,52,10,1,C.cyan);
 }else if(key==='THINK'){
  for(let x=16;x<=38;x+=6){r(x,26,3,5,C.ink);r(x,49,3,5,C.ink);r(x,27,2,2,C.gold);r(x,50,2,3,C.gold);}for(let y=32;y<=44;y+=6){r(9,y,5,3,C.ink);r(43,y,5,3,C.ink);r(10,y,3,2,C.gold);r(44,y,3,2,C.gold);}
  r(13,30,31,20,C.ink);r(15,32,27,16,C.green);r(18,34,21,12,C.ink);r(20,36,17,8,'#80bfc0');r(21,37,4,2,'#d1efc3');r(27,37,8,1,C.mint);r(26,40,9,2,C.mint);
  shape([[30,9],[51,9],[55,13],[55,24],[51,28],[40,28],[34,32],[35,27],[30,25],[27,21],[27,13]],C.ink);shape([[31,11],[50,11],[53,14],[53,23],[50,26],[40,26],[37,28],[38,25],[31,24],[29,20],[29,14]],C.white);for(let i=0;i<3;i++)r(33+i*6,18,3,3,C.blue);r(31,12,18,1,'#e4f2ff');
 }else if(key==='SAVE'){
  shape([[16,12],[43,12],[49,18],[49,53],[16,53]],C.ink);shape([[18,14],[42,14],[47,19],[47,51],[18,51]],C.blue);r(19,15,2,34,'#8fb9f1');r(24,14,17,15,C.silver);r(25,15,15,2,C.white);r(35,16,4,10,'#5d728e');r(23,36,19,15,C.white);r(24,38,17,3,'#a6bdcf');r(26,44,12,1,'#aab8bf');r(26,47,9,1,'#aab8bf');r(20,49,2,2,C.ink);star(47,29);
 }else{
  monitor(17,20);r(39,33,12,15,C.ink);r(40,34,10,13,C.white);r(43,36,5,2,C.blue);r(46,38,2,3,C.blue);r(44,40,3,2,C.blue);r(44,44,2,2,C.blue);
 }
 return p;
}
