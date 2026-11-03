import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const apiKey=Deno.env.get('BOLNA_API_KEY')||'';
const origins=['https://winturbo.live','https://winturbo.io','https://winturbo.vercel.app'];
const uuid=(v:any)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const phone=(v:any)=>{let n=String(v||'').replace(/\D/g,'');if(n.length===10)n='91'+n;return /^[1-9]\d{7,14}$/.test(n)?'+'+n:'';};
const day=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const read=(r:any)=>{if(r.error)throw Error('Database operation failed. Please refresh and retry.');return r.data;};
async function provider(path:string,body?:any){
 if(!apiKey)throw Error('Add BOLNA_API_KEY in Supabase Edge Function Secrets to connect Bolna.');
 const r=await fetch('https://api.bolna.ai'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},...body?{body:JSON.stringify(body)}:{},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Bolna returned HTTP '+r.status+'. Check the API key, agent and wallet in Bolna.');
 return await r.json();
}
const cases=['callback','support','manual'];
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',allowed=origins.includes(origin);
 const headers={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin','Access-Control-Allow-Origin':allowed?origin:'https://winturbo.live','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!allowed)return reply({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({error:'Use POST'},405);
 try{
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';if(!token)return reply({error:'Sign in as an administrator.'},401);
 const identity=await db.auth.getUser(token);if(identity.error||!identity.data.user)return reply({error:'Session expired. Sign in again.'},401);
 const user=identity.data.user,p=read(await db.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle());if(p?.role!=='admin'||!p.is_active)return reply({error:'Administrator access required.'},403);
 const raw=await req.text();if(raw.length>24000)return reply({error:'Request too large'},413);let b;try{b=JSON.parse(raw)}catch{return reply({error:'Invalid request'},400)}
 if(b.action==='connection'){
  if(!apiKey)return reply({configured:false,connected:false,message:'Add BOLNA_API_KEY in Supabase → Edge Functions → Secrets. No calls can launch until connected.'});
  const me=await provider('/user/me');return reply({configured:true,connected:true,message:'Bolna API connection verified.',wallet:me.wallet??null,concurrency:me.concurrency??me.concurrent_calls??null});
 }
 if(b.action==='check_agent'){
  if(!uuid(b.agent_id))return reply({error:'Enter a valid Bolna Agent ID.'},400);const agent=await provider('/v2/agent/'+b.agent_id);const serialized=JSON.stringify(agent);return reply({ok:true,name:agent.agent_config?.agent_name||agent.agent_name||agent.agent?.agent_name||'Bolna agent',case_variable:serialized.includes('{{case_instructions}}'),language_variable:serialized.includes('{{preferred_language}}')});
 }
 if(b.action==='prepare'){
  if(!uuid(b.rule_id)||!Array.isArray(b.lead_keys)||!b.lead_keys.length||b.lead_keys.length>20)return reply({error:'Select a saved case and 1–20 leads.'},400);
  if(b.permission_confirmed!==true||String(b.permission_note||'').trim().length<5)return reply({error:'Record the basis for contacting these leads.'},400);
  const r=read(await db.from('ai_call_rules').select('*').eq('id',b.rule_id).single());if(!cases.includes(r.case_type))return reply({error:'Invalid case.'},400);
  const leads=read(await db.from('lead_intell_records').select('lead_key,phone,username,response,callback_at,lead_source').in('lead_key',[...new Set(b.lead_keys)]));const jobs=[],skipped=[];const seen=new Set();
  for(const l of leads){const number=phone(l.phone);let reason='';if(!number)reason='Invalid or missing number';else if(seen.has(number))reason='Duplicate number';else if(['Connected Not Interested','Do Not Call','DND'].includes(l.response))reason='Not interested / Do Not Call';else if(r.lead_source&&l.lead_source!==r.lead_source||r.response_filter&&l.response!==r.response_filter)reason='No longer matches case';else if(r.case_type==='callback'&&(l.response!=='Call Back'||!l.callback_at||Date.parse(l.callback_at)>Date.now()))reason='Callback not due';
   if(!reason){const d=read(await db.from('ai_call_contacts').select('do_not_call').eq('phone',number).maybeSingle());if(d?.do_not_call)reason='On Do Not Call list';}if(reason){skipped.push({lead_key:l.lead_key,reason});continue;}seen.add(number);
   const row={rule_id:r.id,lead_key:l.lead_key,phone:number,agent_id:r.agent_id,call_day:day(),case_snapshot:{name:r.name,case_type:r.case_type,instructions:r.instructions,language:r.language},permission_note:String(b.permission_note).trim().slice(0,1000),created_by:user.id};
   const saved=await db.from('ai_call_jobs').insert(row).select('id').single();if(saved.error?.code==='23505')skipped.push({lead_key:l.lead_key,reason:'Already queued or called today'});else {read(saved);jobs.push(saved.data.id);}
  }
  return reply({ok:true,prepared:jobs.length,skipped,message:'Prepared for review. No call has been placed.'});
 }
 if(b.action==='cancel'){
  if(!uuid(b.job_id))return reply({error:'Invalid job'},400);const rows=read(await db.from('ai_call_jobs').update({status:'cancelled'}).eq('id',b.job_id).eq('status','ready').select('id'));return reply({ok:true,cancelled:rows.length});
 }
 if(b.action==='launch'){
  if(!uuid(b.job_id)||b.confirm_call!==true)return reply({error:'Review and confirm this call first.'},400);
  if(!apiKey)return reply({error:'Bolna is not connected. Add BOLNA_API_KEY first.'},409);
  const j=read(await db.from('ai_call_jobs').select('*').eq('id',b.job_id).single());if(j.status!=='ready')return reply({error:'This call was already launched or cancelled. Refresh.'},409);
  const l=read(await db.from('lead_intell_records').select('phone,response').eq('lead_key',j.lead_key).maybeSingle());if(!l||phone(l.phone)!==j.phone||['Connected Not Interested','Do Not Call','DND'].includes(l.response))return reply({error:'Lead number or contact preference changed. Cancel this queued call.'},409);
  const a=await provider('/v2/agent/'+j.agent_id),configuration=JSON.stringify(a);if(!configuration.includes('{{case_instructions}}')||!configuration.includes('{{preferred_language}}'))return reply({error:'Add {{case_instructions}} and {{preferred_language}} to this Bolna agent prompt before launching.'},409);
  const claim=read(await db.rpc('ai_call_claim',{p_job:j.id}));if(claim.error)return reply({error:claim.error},409);
  // Claim is durable before the external request. Ambiguous failures must never auto-redial.
  try{
   const c=j.case_snapshot,context='You are an AI support assistant calling on behalf of WinTurbo. Introduce yourself as AI and explain this support call. Ask if it is a convenient time. Respect refusal or a request not to call. Never request passwords, OTPs or bank credentials, offer gambling advice or promote deposits. Do not disclose account records without secure verification. Specific support case: '+c.instructions;
   const result=await provider('/call',{agent_id:j.agent_id,recipient_phone_number:j.phone,user_data:{case_instructions:context,preferred_language:c.language,support_case:c.case_type,call_reference:j.id}});
   if(typeof result.execution_id!=='string'||!uuid(result.execution_id))throw Error('No execution ID returned.');
   read(await db.from('ai_call_jobs').update({status:'submitted',execution_id:result.execution_id,provider_status:result.status||'queued',error:null}).eq('id',j.id));return reply({ok:true,execution_id:result.execution_id,status:result.status||'queued'});
  }catch{await db.from('ai_call_jobs').update({status:'unknown',error:'Provider result is uncertain. Check Bolna call history before any further action. This job cannot be redialled.'}).eq('id',j.id);return reply({error:'Call result is uncertain. Check Bolna call history; automatic retry is disabled.'},502);}
 }
 if(b.action==='sync'){
  if(!Array.isArray(b.job_ids)||b.job_ids.length>20||!b.job_ids.every(uuid))return reply({error:'Select at most 20 call records.'},400);
  const jobs=read(await db.from('ai_call_jobs').select('id,execution_id').in('id',b.job_ids));let synced=0;const errors=[];
  for(const j of jobs){if(!j.execution_id)continue;try{const r=await provider('/executions/'+encodeURIComponent(j.execution_id));if(r.id&&r.id!==j.execution_id)throw Error('Execution mismatch');const terminal=['completed','no-answer','busy','failed','canceled','stopped','error','balance-low'];
   const payload:any={provider_status:r.status||'unknown',synced_at:new Date().toISOString()};if(terminal.includes(r.status)){payload.status='finished';payload.transcript=typeof r.transcript==='string'?r.transcript:null;payload.summary=typeof r.summary==='string'?r.summary:null;payload.recording_url=r.telephony_data?.recording_url||r.recording_url||null;payload.duration_seconds=Number.isFinite(Number(r.conversation_duration))?Number(r.conversation_duration):null;payload.reported_cost=r.total_cost!=null&&Number.isFinite(Number(r.total_cost))?Number(r.total_cost):null;payload.extracted_data=r.extracted_data||null;}
   read(await db.from('ai_call_jobs').update(payload).eq('id',j.id));synced++;
  }catch(e){errors.push({id:j.id,error:e instanceof Error?e.message:'Sync failed'});}}
  return reply({ok:true,synced,errors});
 }
 return reply({error:'Unknown action'},400);
 }catch(e){return reply({error:e instanceof Error?e.message:'AI Call Intell is temporarily unavailable.'},502);}
});
