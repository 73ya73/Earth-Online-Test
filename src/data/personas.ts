import data from './personas.json';
export type Book={title:string;author:string;reason:string;url:string};
export type Persona={name:string;quote:string;description:string;systemMessage:string;rechargeTip:string;ways:string[];artLabel:string;books:Book[]};
export const personas=data as Record<string,Persona>;
