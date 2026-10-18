import React from 'react';
import {answerIds} from '../scoring/answers.js';
type Option={optionId:string;text:string};
type Question={questionId:string;text:string;selectionMode:string;maxSelections:number;exclusiveOptions:string[];exclusiveControl?:string;options:Option[]};
export function QuestionChoices({question,answer,onSelect}:{question:Question;answer:string[]|undefined;onSelect:(id:string)=>void}){
 const q=question, multiple=q.selectionMode==='multiple',selected=answerIds(q,answer);
 const exclusive=q.exclusiveOptions||[];
 const groups=exclusive.length?[
  {id:'multi',label:q.exclusiveControl==='radio'?`多选区域 · 最多选择${q.maxSelections===2?'两':q.maxSelections}项`:'多选区域 · 可选择多项',options:q.options.filter(o=>!exclusive.includes(o.optionId))},
  {id:'exclusive',label:'独立选项 · 不与以上选项同时选择',options:q.options.filter(o=>exclusive.includes(o.optionId))}
 ]:[{id:'all',label:multiple?`多选题 · 最多选择 ${q.maxSelections} 项（可只选 1 项）`:'单选题 · 请选择 1 项',options:q.options}];
 return <div className={`question-choices ${q.options.length>=6?'many-options':''}`} role={multiple?'group':'radiogroup'} aria-labelledby="page-title">{groups.map(group=><div className={`choice-group choice-group-${group.id}`} key={group.id}><div className="selection-hint" id={`${q.questionId}-${group.id}-hint`}><span>{group.label}</span></div><div className="choice-list" role={group.id==='exclusive'&&q.exclusiveControl==='radio'?'radiogroup':undefined} aria-label={group.id==='exclusive'?'独立互斥选项':undefined}>{group.options.map(o=><ChoiceOption key={o.optionId} option={o} questionId={q.questionId} multiple={multiple} radioStyle={q.exclusiveControl==='radio'&&exclusive.includes(o.optionId)} selected={selected.includes(o.optionId)} hintId={`${q.questionId}-${group.id}-hint`} onSelect={onSelect}/>)}</div></div>)}</div>;
}
function ChoiceOption({option,questionId,multiple,radioStyle,selected,hintId,onSelect}:{option:Option;questionId:string;multiple:boolean;radioStyle:boolean;selected:boolean;hintId:string;onSelect:(id:string)=>void}){
 return <label className={`option choice-option ${selected?'selected':''}`}><input className="choice-control" type={multiple&&!radioStyle?'checkbox':'radio'} name={radioStyle?`${questionId}-exclusive`:questionId} value={option.optionId} checked={selected} aria-describedby={hintId} onClick={()=>{if(radioStyle&&selected)onSelect(option.optionId);}} onChange={()=>{if(!radioStyle||!selected)onSelect(option.optionId);}}/><span className="letter">{option.optionId}</span><span className="choice-text">{option.text.slice(3)}</span></label>;
}
