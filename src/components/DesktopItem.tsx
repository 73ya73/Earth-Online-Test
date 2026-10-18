import React,{useRef} from 'react';
type Props=React.ButtonHTMLAttributes<HTMLButtonElement>&{onActivate:()=>void;onSelect:()=>void};
export function DesktopItem({onActivate,onSelect,children,...props}:Props){
 const pointer=useRef('mouse');
 return <button {...props} onPointerDown={e=>{pointer.current=e.pointerType||'mouse';}} onClick={e=>{onSelect();if(e.detail===0||pointer.current==='touch'||pointer.current==='pen')onActivate();}} onDoubleClick={()=>{if(pointer.current!=='touch'&&pointer.current!=='pen')onActivate();}}>{children}</button>;
}
