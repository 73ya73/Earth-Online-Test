import {createHandler} from '../_shared/handler.js';
const url=Deno.env.get('SUPABASE_URL');
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const origins=(Deno.env.get('RESEARCH_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
if(!url||!key||!origins.length)throw new Error('Research server configuration missing');
Deno.serve(createHandler({origins,insert:async(record:unknown)=>{
 const response=await fetch(`${url}/rest/v1/rpc/store_research_submission`,{
  method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},
  body:JSON.stringify({record}),signal:AbortSignal.timeout(5000),
 });
 if(!response.ok)throw new Error('storage_unavailable');
 return await response.json();
}}));
