import {build} from 'esbuild';
import {mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),out=new URL('supabase/dashboard/',root);
await mkdir(out,{recursive:true});
const paths=['submit-research/index.ts','_shared/handler.js','_shared/research.js','_shared/questions.js','_shared/scoring/answers.js','_shared/scoring/engine.js'];
const hash=createHash('sha256');for(const path of paths)hash.update(path+'\n').update((await readFile(new URL('supabase/functions/'+path,root),'utf8')).replace(/\r\n/g,'\n'));
const digest=hash.digest('hex');
await build({
 entryPoints:[fileURLToPath(new URL('supabase/functions/submit-research/index.ts',root))],
 outfile:fileURLToPath(new URL('submit-research.ts',out)),bundle:true,format:'esm',platform:'neutral',target:'es2022',
 banner:{js:'// @ts-nocheck -- Generated JavaScript bundle in the Dashboard TypeScript entrypoint.\n// GENERATED for Supabase Dashboard: paste this ENTIRE file into submit-research/index.ts.\n// Source: supabase/functions/submit-research/index.ts and _shared/. No secret values included.\n// Source SHA-256: '+digest+'\n// Regenerate: node scripts/sync-research.mjs && node scripts/bundle-research.mjs'},
});
console.log('Created supabase/dashboard/submit-research.ts (self-contained Dashboard entrypoint).');
