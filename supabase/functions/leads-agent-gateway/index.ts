import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import './core.js';
const core=(globalThis as any).LeadsIntellCore;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const phone=(v:unknown)=>{let s=String(v??'').replace(/[\s().-]/g,'');if(/^\d{10}$/.test(s))s='+91'+s;else if(/^91\d{10}$/.test(s))s='+'+s;if(/^00/.test(s))s='+'+s.slice(2);if(!/^\+[1-9]\d{7,14}$/.test(s))throw Error('Enter a valid phone number, for example +919876543210 or 9876543210.');return s};
const mask=(v:unknown)=>{const digits=String(v??'').replace(/\D/g,'');return digits?'xxxxx'+digits.slice(-5):'No phone'};
const safeName=(v:unknown)=>/^\+?\d[\d\s()-]{6,}$/.test(String(v??''))?mask(v):String(v??'');
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 let stage='authenticate',actionLabel='unknown';
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Sign in required'},401);
  const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return json({error:'Sign in required'},401);
  const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',user.id).single();if(profileError||!profile?.is_active)return json({error:'Access denied'},403);
  const admin=profile.role==='admin',body=await req.json(),action=body.action;actionLabel=['agents','create_agent','update_agent','history','list','open','close','save','login','import','wati_sources'].includes(action)?action:'unknown';stage='validate_request';
  const check=(r:any)=>{if(r.error)throw Error(r.error.message);return r.data};
  if(['agents','create_agent','update_agent','history'].includes(action)){
   if(!admin)return json({error:'Admin access required'},403);
   if(action==='agents')return json({agents:check(await db.from('leads_agents').select('user_id,phone,name,is_active,created_at').order('created_at',{ascending:false}))});
   if(action==='history')return json({history:check(await db.from('leads_edit_history').select('id,lead_key,actor_id,response,callback_at,notes,before_values,after_values,changed_at').order('id',{ascending:false}).limit(100)),logins:check(await db.from('leads_login_history').select('actor_id,logged_in_at').order('logged_in_at',{ascending:false}).limit(100))});
   stage='validate_agent_name';const name=String(body.name||'').trim();if(!name||name.length>100)throw Error('Enter an agent name (up to 100 characters).');
   stage='validate_agent_phone';const number=phone(body.phone);stage='validate_agent_password';const password=String(body.password||'');if((action==='create_agent'||password)&&password.length<10)throw Error('Use a password with at least 10 characters.');
   if(action==='create_agent'){
    const email='agent-'+number.slice(1)+'@agents.winturbo.live';
    if(check(await db.from('leads_agents').select('user_id').eq('phone',number).maybeSingle()))throw Error('This phone number is already assigned to an agent.');
    stage='create_access_grant';const grantRow=check(await db.from('user_access_grants').insert({email,access_level:'section',allowed_sections:['leadsIntell'],is_active:true,granted_by:user.id}).select('id').single());
    stage='create_auth_account';const created=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
    if(created.error){await db.from('user_access_grants').delete().eq('id',grantRow.id);throw Error(created.error.message)}
    const id=created.data.user.id;stage='save_agent_profile';
    try{check(await db.from('leads_agents').insert({user_id:id,phone:number,name,is_active:body.is_active!==false,created_by:user.id}));check(await db.from('profiles').update({role:'viewer',is_active:body.is_active!==false,full_name:name}).eq('id',id));if(body.is_active===false)check(await db.from('user_access_grants').update({is_active:false}).eq('user_id',id));}
    catch(e){await db.auth.admin.deleteUser(id);await db.from('user_access_grants').delete().eq('id',grantRow.id);throw e}
    return json({ok:true});
   }
   const existing=check(await db.from('leads_agents').select('user_id,phone,name,is_active').eq('user_id',body.user_id).single());
   const email='agent-'+number.slice(1)+'@agents.winturbo.live';const duplicate=check(await db.from('leads_agents').select('user_id').eq('phone',number).maybeSingle());if(duplicate&&duplicate.user_id!==existing.user_id)throw Error('This phone number is already assigned to an agent.');
   const updated=await db.auth.admin.updateUserById(existing.user_id,{email,email_confirm:true,...(password?{password}:{}),user_metadata:{full_name:name}});if(updated.error)throw Error(updated.error.message);
   const active=body.is_active===true;
   check(await db.from('leads_agents').update({phone:number,name,is_active:active}).eq('user_id',existing.user_id));
   check(await db.from('user_access_grants').update({email,is_active:active,access_level:'section',allowed_sections:['leadsIntell']}).eq('user_id',existing.user_id));
   check(await db.from('profiles').update({email,full_name:name,is_active:active}).eq('id',existing.user_id));
   if(!active)check(await db.from('leads_agent_sessions').delete().eq('user_id',existing.user_id));
   return json({ok:true});
  }
  const agent=check(await db.from('leads_agents').select('user_id,name,is_active').eq('user_id',user.id).maybeSingle());
  const grant=check(await db.from('user_access_grants').select('is_active,access_level,allowed_sections').eq('user_id',user.id).maybeSingle());
  if(!agent?.is_active||!grant?.is_active||grant.access_level!=='section'||!grant.allowed_sections?.includes('leadsIntell'))return json({error:'Agent access inactive'},403);
  if(action==='wati_sources')return json({connections:check(await db.from('wati_connections').select('id,label,business_number').order('label'))});
  if(action==='login'){
   const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
   check(await db.rpc('record_agent_login',{p_actor:user.id,p_session:claims.session_id}));
   return json({ok:true});
  }
  async function all(table:string,columns:string,order:string){let rows:any[]=[],start=0;for(;;){const batch=check(await db.from(table).select(columns).order(order).range(start,start+999));rows.push(...batch);if(batch.length<1000)return rows;start+=batch.length}}
  // Imports need identity columns only; do not transfer every saved note/response on each batch.
  const [players,records]=await Promise.all([all('admin_players',action==='import'?'username,phone':'username,phone,ftd,lifetime_deposits,deposit_count,registered_at','username'),all('lead_intell_records',action==='import'?'lead_key,username,phone':'*','lead_key')]);
  if(action==='import'){
   stage='validate_lead_import';
   const source=body.source===undefined?'Manual':typeof body.source==='string'?body.source.trim():'';
   if(!source||source.length>100||/[\x00-\x1f\x7f]/.test(source))return json({error:'Enter a lead source (1–100 characters).'},400);
   if(!Array.isArray(body.items)||body.items.length<1||body.items.length>5000)return json({error:'Import between 1 and 5,000 leads per request.'},400);
   const keys=new Set(records.map((r:any)=>r.lead_key)),users=new Set([...players,...records].map((r:any)=>String(r.username||'').trim().toLowerCase()).filter(Boolean)),numbers=new Set([...players,...records].map((r:any)=>core.phone(r.phone)).filter(Boolean));
   let skipped=0,invalid=0;const fresh:any[]=[],leadDate=core.day();
   for(const item of body.items){
    if(!item||typeof item!=='object'||(item.phone!=null&&typeof item.phone!=='string')||(item.username!=null&&typeof item.username!=='string')){invalid++;continue}
    const rawPhone=String(item.phone||'').trim(),rawUser=String(item.username||'').trim();
    const number=core.phone(rawPhone),username=core.username(rawUser);
    if((rawPhone&&!number)||(rawUser&&!username)||(!number&&!username)){invalid++;continue}
    const lead_key=username?'user:'+username.toLowerCase():'phone:'+number;
    if(keys.has(lead_key)||(username&&users.has(username.toLowerCase()))||(number&&numbers.has(number))){skipped++;continue}
    keys.add(lead_key);if(username)users.add(username.toLowerCase());if(number)numbers.add(number);
    // Only new identities can be inserted. Ignore client keys, ownership, response and status fields.
    fresh.push({lead_key,username:username||null,phone:number||null,lead_source:source,lead_date:leadDate,tags:['Agent Upload'],updated_by:user.id});
   }
   // Keep each returned rowset within the Data API's default 1,000-row cap.
   // Identity scans and validation still happen just once for all 5,000 inputs.
   stage='insert_agent_leads';let added=0;
   for(let i=0;i<fresh.length;i+=1000){const batch=fresh.slice(i,i+1000),saved=check(await db.from('lead_intell_records').upsert(batch,{onConflict:'lead_key',ignoreDuplicates:true}).select('lead_key'));added+=saved.length;skipped+=batch.length-saved.length}
   return json({ok:true,added,skipped,invalid});
  }
  const names=new Map((await all('leads_agents','user_id,name','user_id')).map((x:any)=>[x.user_id,x.name]));const leads=core.attachWati(core.merge(players,records),await all('wati_contacts','phone,connection_id,first_seen_at,contact_created_at','phone')),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const opaque=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
  if(action==='list'){
   const page=Math.max(0,Math.floor(Number(body.page)||0)),pageSize=Math.max(1,Math.min(5000,Math.floor(Number(body.page_size)||50)));
   const selected=await Promise.all(leads.slice(page*pageSize,(page+1)*pageSize).map(async(lead:any)=>({lead,id:await opaque(lead.key)})));
   const contactActivity=new Map();
   if(body.contact_view===true){
    // Only summary dates/status leave the server. Raw call numbers and edit history stay private.
    const selectedPhones=[...new Set(selected.map(({lead}:any)=>core.phone(lead.phone)).filter(Boolean))];
    const selectedKeys=[...new Set(selected.map(({lead}:any)=>lead.record?.lead_key||lead.key))];
    const activityByPhone=new Map(),calledKeys=new Set();
    // Independent activity lookups run in bounded waves, rather than waiting
    // for 100 serial round trips on each large contact page.
    const tasks:Array<()=>Promise<void>>=[];
    for(let i=0;i<selectedPhones.length;i+=100){const numbers=selectedPhones.slice(i,i+100);
     tasks.push(async()=>{const variants=[...new Set(numbers.flatMap((n:string)=>[n,'+91'+n,'91'+n,'+'+n]))];
     for(let start=0;;){const rows=check(await db.from('stringeex_calls').select('call_id,phone,status,started_at,end_reason').in('phone',variants).order('call_id').range(start,start+499));
      for(const call of rows){const number=core.phone(call.phone);if(!activityByPhone.has(number))activityByPhone.set(number,[]);activityByPhone.get(number).push(call)}
      if(rows.length<500)break;start+=rows.length;
     }});
    }
    for(let i=0;i<selectedKeys.length;i+=100){const keys=selectedKeys.slice(i,i+100);tasks.push(async()=>{
     for(let start=0;;){const rows=check(await db.from('leads_edit_history').select('id,lead_key').in('lead_key',keys).in('response',['Disconnected','Connected Not Interested','Need Offer','Call Back']).order('id').range(start,start+499));
      rows.forEach((r:any)=>calledKeys.add(r.lead_key));if(rows.length<500)break;start+=rows.length;
     }});
    }
    let nextTask=0;await Promise.all(Array.from({length:Math.min(6,tasks.length)},async()=>{while(nextTask<tasks.length){const task=tasks[nextTask++];await task()}}));
    for(const {lead,id} of selected){const calls=activityByPhone.get(core.phone(lead.phone))||[],validDay=(value:any)=>value&&Number.isFinite(Date.parse(value))?core.day(value):null;
     const days=(predicate:any)=>[...new Set(calls.filter(predicate).map((c:any)=>validDay(c.started_at)).filter(Boolean))];
     const latest=calls.reduce((a:any,b:any)=>!a||Date.parse(b.started_at)>Date.parse(a.started_at)?b:a,null);
     contactActivity.set(id,{attempted:calls.length>0||calledKeys.has(lead.record?.lead_key||lead.key)||['Disconnected','Connected Not Interested','Need Offer','Call Back'].includes(lead.record?.response),answered_days:days((c:any)=>c.status==='Answered'),disconnected_days:days((c:any)=>c.status==='Disconnected'||/DISCONNECT/i.test(c.end_reason||'')),last_call:latest?{status:latest.status,started_at:latest.started_at,end_reason:latest.end_reason}:null});
    }
   }
   return json({total:leads.length,page_size:pageSize,rows:selected.map(({lead:l,id}:any)=>({key:id,...(body.contact_view===true?{contact_activity:contactActivity.get(id)}:{}),editor_name:names.get(l.record?.updated_by)||null,username:safeName(l.username),phone:mask(l.phone),source:l.source,wati_connection_ids:l.wati_connection_ids,registration:l.registration,lifetime_deposits:l.lifetime_deposits,deposit_count:l.deposit_count,registered_at:l.registered_at,created_at:l.record?.created_at||l.created_at,record:l.record?{lead_date:l.record.lead_date,lead_source:l.record.lead_source,tags:(l.record.tags||[]).filter((t:string)=>t.startsWith('WATI:')),response:l.record.response,callback_at:l.record.callback_at,updated_at:l.record.updated_at}:null}))});
  }
  const mapped=await Promise.all(leads.map(async(lead:any)=>({lead,id:await opaque(lead.key)})));
  const found=mapped.find((x:any)=>x.id===body.key);if(!found)return json({error:'Lead not found'},404);const l=found.lead;
  if(action==='open'){
   const session=check(await db.from('leads_agent_sessions').upsert({user_id:user.id,lead_key:l.record?.lead_key||l.key,edit_token:crypto.randomUUID(),expires_at:new Date(Date.now()+15*60000).toISOString()}).select('edit_token').single());
   return json({lead:{key:found.id,username:l.username,phone:l.phone,source:l.source,wati_connection_ids:l.wati_connection_ids,registration:l.registration,lifetime_deposits:l.lifetime_deposits,record:l.record?{lead_source:l.record.lead_source,tags:(l.record.tags||[]).filter((t:string)=>t.startsWith('WATI:')),response:l.record.response,callback_at:l.record.callback_at,notes:l.record.notes}:null},edit_token:session.edit_token});
  }
  if(action==='close'){check(await db.from('leads_agent_sessions').delete().eq('user_id',user.id).eq('edit_token',body.edit_token));return json({ok:true})}
  if(action==='save'){
   const response=body.response||null,notes=String(body.notes||'');if(response&&!core.responses.includes(response))throw Error('Invalid response');if(notes.length>2000)throw Error('Notes must be at most 2000 characters.');
   const callback=response==='Call Back'?body.callback_at:null;if(response==='Call Back'&&(!callback||!Number.isFinite(Date.parse(callback))||Date.parse(callback)<=Date.now()))throw Error('Choose a future callback time.');
   check(await db.rpc('save_agent_lead',{p_actor:user.id,p_key:l.record?.lead_key||l.key,p_token:body.edit_token,p_username:l.username||null,p_phone:l.phone||null,p_response:response,p_callback:callback,p_notes:notes}));
   return json({ok:true});
  }
  return json({error:'Unknown action'},400);
 }catch(e){const detail=e instanceof Error?e.message:String((e as any)?.message||'Request failed');console.error(JSON.stringify({event:'agent_gateway_failure',action:actionLabel,stage,code:String((e as any)?.code||'request_rejected')}));return json({error:detail+' [step: '+stage+']'},400)}
});


