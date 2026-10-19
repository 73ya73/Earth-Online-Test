import {createHandler} from '../_shared/handler.js';
const url=Deno.env.get('SUPABASE_URL');
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const origins=(Deno.env.get('RESEARCH_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
if(!url||!key||!origins.length)throw new Error('Research server configuration missing');
Deno.serve(createHandler({origins,insert:async(record:unknown)=>{
 try{
  const response=await fetch(`${url}/rest/v1/rpc/store_research_submission_v2`,{
   method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},
   body:JSON.stringify({record}),signal:AbortSignal.timeout(10000),
  });
  if(!response.ok){
   let code='';try{const body=await response.json();if(/^[A-Z0-9]{5}$/.test(body?.code))code=body.code;}catch{}
   const category=code==='23505'?'id_conflict':code==='42501'||[401,403].includes(response.status)?'permission':code.startsWith('22')||code.startsWith('23')?'database_rejected':'database';
   throw Object.assign(new Error(category),{category,upstreamStatus:response.status,dbCode:code});
  }
  return await response.json();
 }catch(error:any){
  if(error.category)throw error;
  throw Object.assign(new Error('RPC transport failed'),{category:['TimeoutError','AbortError'].includes(error.name)?'timeout':'network'});
 }
}}));
