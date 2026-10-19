import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import './core.js';
const core=(globalThis as any).LeadsIntellCore;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const phone=(v:unknown)=>{let s=String(v??'').replace(/[\s().-]/g,'');if(/^\d{10}$/.test(s))s='+91'+s;if(/^00/.test(s))s='+'+s.slice(2);if(!/^\+[1-9]\d{7,14}$/.test(s))throw Error('Enter a valid phone number with country code.');return s};
const mask=(v:unknown)=>{const digits=String(v??'').replace(/\D/g,'');return digits?'xxxxx'+digits.slice(-5):'No phone'};
const safeName=(v:unknown)=>/^\+?\d[\d\s()-]{6,}$/.test(String(v??''))?mask(v):String(v??'');
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Sign in required'},401);
  const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return json({error:'Sign in required'},401);
  const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',user.id).single();if(profileError||!profile?.is_active)return json({error:'Access denied'},403);
  const admin=profile.role==='admin',body=await req.json(),action=body.action;
  const check=(r:any)=>{if(r.error)throw Error(r.error.message);return r.data};
  if(['agents','create_agent','update_agent','history'].includes(action)){
   if(!admin)return json({error:'Admin access required'},403);
   if(action==='agents')return json({agents:check(await db.from('leads_agents').select('user_id,phone,name,is_active,created_at').order('created_at',{ascending:false}))});
   if(action==='history')return json({history:check(await db.from('leads_edit_history').select('id,lead_key,actor_id,response,callback_at,changed_at').order('id',{ascending:false}).limit(100))});
   const name=String(body.name||'').trim();if(!name||name.length>100)throw Error('Enter an agent name (up to 100 characters).');
   const number=phone(body.phone),password=String(body.password||'');if((action==='create_agent'||password)&&password.length<10)throw Error('Use a password with at least 10 characters.');
   if(action==='create_agent'){
    const email='agent-'+number.slice(1)+'@agents.winturbo.live';
    if(check(await db.from('leads_agents').select('user_id').eq('phone',number).maybeSingle()))throw Error('This phone number is already assigned to an agent.');
    const grantRow=check(await db.from('user_access_grants').insert({email,access_level:'section',allowed_sections:['leadsIntell'],is_active:true,granted_by:user.id}).select('id').single());
    const created=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
    if(created.error){await db.from('user_access_grants').delete().eq('id',grantRow.id);throw Error(created.error.message)}
    const id=created.data.user.id;
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
  async function all(table:string,columns:string,order:string){let rows:any[]=[],start=0;for(;;){const batch=check(await db.from(table).select(columns).order(order).range(start,start+499));rows.push(...batch);if(batch.length<500)return rows;start+=batch.length}}
  const [players,records]=await Promise.all([all('admin_players','username,phone,ftd,lifetime_deposits,deposit_count,registered_at','username'),all('lead_intell_records','*','lead_key')]);
  const names=new Map((await all('leads_agents','user_id,name','user_id')).map((x:any)=>[x.user_id,x.name]));const leads=core.merge(players,records),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const opaque=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const mapped=await Promise.all(leads.map(async(lead:any)=>({lead,id:await opaque(lead.key)})));
  if(action==='list'){
   const page=Math.max(0,Math.floor(Number(body.page)||0)),selected=mapped.slice(page*50,page*50+50);
   return json({total:leads.length,rows:selected.map(({lead:l,id}:any)=>({key:id,editor_name:names.get(l.record?.updated_by)||null,username:safeName(l.username),phone:mask(l.phone),source:l.source,lifetime_deposits:l.lifetime_deposits,deposit_count:l.deposit_count,registered_at:l.registered_at,created_at:l.record?.created_at,record:l.record?{response:l.record.response,callback_at:l.record.callback_at,updated_at:l.record.updated_at}:null}))});
  }
  const found=mapped.find((x:any)=>x.id===body.key);if(!found)return json({error:'Lead not found'},404);const l=found.lead;
  if(action==='open'){
   const session=check(await db.from('leads_agent_sessions').upsert({user_id:user.id,lead_key:l.record?.lead_key||l.key,edit_token:crypto.randomUUID(),expires_at:new Date(Date.now()+15*60000).toISOString()}).select('edit_token').single());
   return json({lead:{key:found.id,username:l.username,phone:l.phone,source:l.source,lifetime_deposits:l.lifetime_deposits,record:l.record?{response:l.record.response,callback_at:l.record.callback_at,notes:l.record.notes}:null},edit_token:session.edit_token});
  }
  if(action==='close'){check(await db.from('leads_agent_sessions').delete().eq('user_id',user.id).eq('edit_token',body.edit_token));return json({ok:true})}
  if(action==='save'){
   const response=body.response||null,notes=String(body.notes||'');if(response&&!core.responses.includes(response))throw Error('Invalid response');if(notes.length>2000)throw Error('Notes must be at most 2000 characters.');
   const callback=response==='Call Back'?body.callback_at:null;if(response==='Call Back'&&(!callback||!Number.isFinite(Date.parse(callback))||Date.parse(callback)<=Date.now()))throw Error('Choose a future callback time.');
   check(await db.rpc('save_agent_lead',{p_actor:user.id,p_key:l.record?.lead_key||l.key,p_token:body.edit_token,p_username:l.username||null,p_phone:l.phone||null,p_response:response,p_callback:callback,p_notes:notes}));
   return json({ok:true});
  }
  return json({error:'Unknown action'},400);
 }catch(e){return json({error:e instanceof Error?e.message:'Request failed'},400)}
});
