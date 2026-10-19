import {createSubmission} from './research.js';
import {calculateV17} from '../scoring/v17.js';
export function createV17Submission(questions,answers,locale='zh'){
 const base=createSubmission(questions,answers);if(!base)return null;
 const result=calculateV17(questions,answers);
 return {...base,result_type:[result.finalType],scores:result.totals,
  candidate_types:result.candidates.map(c=>c.key),algorithm_version:result.config.version,locale};
}
