import questions from './questions.js';
import {calculate} from './scoring/engine.js';
import {calculateV17} from './scoring/v17.js';
import {V17_CONFIG} from './scoring/v17-config.js';
import {validateSubmission,UUID} from './research.js';
export function validateV17Submission(input,now=new Date()){
 const fields=['submission_id','submitted_at','answers','result_type','scores','candidate_types','algorithm_version','locale'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==8||!fields.every(k=>Object.hasOwn(input,k))||!UUID.test(input.submission_id))throw Error('invalid_record');
 if(input.algorithm_version!==V17_CONFIG.version||!['zh','en'].includes(input.locale))throw Error('invalid_record');
 const legacy=calculate(questions,input.answers||{});
 // Reuse the established strict question/option/raw-score validation, without
 // confusing the legacy candidate array with the new final result field.
 const record=validateSubmission({submission_id:input.submission_id,submitted_at:input.submitted_at,answers:input.answers,scores:input.scores,
  result_type:legacy.status==='exploring'?['EXPLORING']:legacy.candidates.map(c=>c.key)},now);
 const result=calculateV17(questions,record.answers);
 const candidates=result.candidates.map(c=>c.key);
 if(!Array.isArray(input.result_type)||input.result_type.length!==1||input.result_type[0]!==result.finalType)throw Error('result_mismatch');
 if(!Array.isArray(input.candidate_types)||input.candidate_types.length!==candidates.length||new Set(input.candidate_types).size!==candidates.length||candidates.some(k=>!input.candidate_types.includes(k)))throw Error('result_mismatch');
 return {...record,result_type:[result.finalType],candidate_types:candidates,algorithm_version:V17_CONFIG.version,locale:input.locale};
}
