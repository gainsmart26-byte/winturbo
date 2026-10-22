import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {phone,normalize} from './call-core.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const check=(r:any)=>{if(r.error)throw Error(r.error.message);return r.data};
async function api(path:string,token:string,options:any={}){
 const r=await fetch('https://api.stringeex.com/v1/'+path,{...options,headers:{'Content-Type':'application/json',...(token?{'X-STRINGEE-AUTH':token}:{}),...options.headers},signal:AbortSignal.timeout(20000)});
 let data;try{data=await r.json()}catch{throw Error('StringeeX returned an unreadable response. Check API access for your account.')}
 if(!r.ok||Number(data.r)!==0)throw Error('StringeeX request rejected ('+r.status+'). Check the account login, API permissions or expired connection.');
 return data;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const bearer=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!bearer)return json({error:'Sign in required'},401);
  const {data:{user},error}=await db.auth.getUser(bearer);if(error||!user)return json({error:'Sign in required'},401);
  const profile=check(await db.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle());if(!profile?.is_active)return json({error:'Access denied'},403);
  const admin=profile.role==='admin',body=await req.json();
  if(body.action==='history'){
   let p='';
   if(admin)p=phone(body.phone);
   else{
    const agent=check(await db.from('leads_agents').select('is_active').eq('user_id',user.id).maybeSingle());
    const grant=check(await db.from('user_access_grants').select('is_active,access_level,allowed_sections').eq('user_id',user.id).maybeSingle());
    if(!agent?.is_active||!grant?.is_active||grant.access_level!=='section'||!grant.allowed_sections?.includes('leadsIntell'))return json({error:'Agent access inactive'},403);
    const session=check(await db.from('leads_agent_sessions').select('lead_key,expires_at').eq('user_id',user.id).eq('edit_token',body.edit_token).maybeSingle());
    if(!session||Date.parse(session.expires_at)<=Date.now())return json({error:'Reopen this lead to view call history.'},403);
    const record=check(await db.from('lead_intell_records').select('phone').eq('lead_key',session.lead_key).maybeSingle());
    if(record?.phone)p=phone(record.phone);
    if(!p&&session.lead_key.startsWith('user:')){const player=check(await db.from('admin_players').select('phone').ilike('username',session.lead_key.slice(5).replace(/[\\%_]/g,'\\$&')).maybeSingle());p=phone(player?.phone)}
   }
   if(!p)return json({calls:[],message:'No valid phone number for this lead.'});
   const connection=check(await db.from('stringeex_connection').select('last_synced_at,auth_token').eq('id',1).maybeSingle());
   let refreshed_at=null,sync_error=null;
   if(connection?.auth_token){try{
    const now=Date.now(),q=new URLSearchParams({version:'2',direction:'0',customer_number:p.length===10?'91'+p:p,time:(now-30*86400000)+'-'+now,sort_order:'desc',sort_by:'start_time'});
    const recent=await api('call/history?'+q,connection.auth_token);
    if(!Array.isArray(recent.data?.rows))throw Error('Unexpected call-history format.');
    const incoming=recent.data.rows.map(normalize).filter((c:any)=>c&&c.phone===p);
    if(incoming.length)check(await db.from('stringeex_calls').upsert(incoming,{onConflict:'call_id'}));
    refreshed_at=new Date().toISOString();
   }catch{sync_error='Live refresh failed. Showing saved call records; ask your admin to check the StringeeX connection.'}}
   const calls=check(await db.from('stringeex_calls').select('call_id,stringeex_agent_id,agent_name,started_at,ended_at,status,duration_seconds,talk_seconds,end_reason').eq('phone',p).order('started_at',{ascending:false}).limit(100));
   const links=check(await db.from('stringeex_agent_links').select('stringeex_id,user_id'));
   const agents=check(await db.from('leads_agents').select('user_id,name'));
   const names=new Map(agents.map((a:any)=>[a.user_id,a.name]));const mapped=new Map(links.map((l:any)=>[l.stringeex_id,names.get(l.user_id)]));
   return json({connected:!!connection,last_synced_at:connection?.last_synced_at,refreshed_at,sync_error,calls:calls.map((c:any)=>({...c,agent_name:mapped.get(c.stringeex_agent_id)||c.agent_name,mapped:!!mapped.get(c.stringeex_agent_id)}))});
  }
  if(!admin)return json({error:'Admin access required'},403);
  if(body.action==='settings'){
   const connection=check(await db.from('stringeex_connection').select('updated_at,last_synced_at,sync_cursor').eq('id',1).maybeSingle());
   const agents=check(await db.from('leads_agents').select('user_id,name,is_active').order('name'));
   const links=check(await db.from('stringeex_agent_links').select('stringeex_id,user_id'));
   const observed=check(await db.from('stringeex_calls').select('stringeex_agent_id,agent_name').order('started_at',{ascending:false}).limit(1000));
   return json({connected:!!connection,last_synced_at:connection?.last_synced_at,pending:!!connection?.sync_cursor,agents,links,observed:[...new Map(observed.filter((c:any)=>c.stringeex_agent_id).map((c:any)=>[c.stringeex_agent_id,c])).values()]});
  }
  if(body.action==='connect'){
   let token=String(body.auth_token||'').trim();
   if(!token){
    if(!body.email||!body.password)throw Error('Enter your StringeeX email and password in this secure form.');
    const login=await api('account','',{method:'POST',body:JSON.stringify({email:String(body.email),password:String(body.password)})});
    if(login.portals?.length!==1)throw Error('This login has multiple portals. Use the auth token for gainsmart.stringeex.com instead.');
    token=login.portals[0]?.auth_token||login.auth_token;
   }
   if(!token||token.length>20000)throw Error('StringeeX did not provide a usable auth token.');
   await api('call/history?version=2&direction=0&time='+(Date.now()-86400000)+'-'+Date.now(),token);
   check(await db.from('stringeex_connection').upsert({id:1,auth_token:token,updated_by:user.id,updated_at:new Date().toISOString(),sync_cursor:null,sync_from:null,sync_to:null,sync_locked_until:null}));
   return json({ok:true});
  }
  if(body.action==='link'){
   const id=String(body.stringeex_id||'').trim();if(!/^[a-zA-Z0-9_-]{1,150}$/.test(id))throw Error('Enter a valid StringeeX user ID.');
   if(!body.user_id){check(await db.from('stringeex_agent_links').delete().eq('stringeex_id',id));return json({ok:true})}
   const agent=check(await db.from('leads_agents').select('user_id').eq('user_id',body.user_id).single());
   check(await db.from('stringeex_agent_links').upsert({stringeex_id:id,user_id:agent.user_id,updated_at:new Date().toISOString()}));return json({ok:true});
  }
  if(body.action==='sync'){
   const connection=check(await db.from('stringeex_connection').select('*').eq('id',1).maybeSingle());if(!connection)return json({error:'Connect StringeeX first.'},409);
   const now=Date.now(),lease=new Date(now+90000).toISOString();
   const locked=check(await db.from('stringeex_connection').update({sync_locked_until:lease}).eq('id',1).or('sync_locked_until.is.null,sync_locked_until.lt.'+new Date(now).toISOString()).select('id'));
   if(!locked.length)return json({busy:true});
   try{
    const from=connection.sync_cursor?connection.sync_from:connection.last_synced_at?Math.max(Date.parse(connection.last_synced_at)-86400000,now-30*86400000):now-30*86400000;
    const to=connection.sync_cursor?connection.sync_to:now;
    const q=new URLSearchParams({version:'2',direction:'0',time:from+'-'+to,sort_order:'asc',sort_by:'start_time'});
    for(const v of connection.sync_cursor||[])q.append('search_after[]',String(v));
    const result=await api('call/history?'+q,connection.auth_token);const source=result.data?.rows;if(!Array.isArray(source))throw Error('Unexpected StringeeX call-history format.');
    const rows=source.map(normalize).filter(Boolean);if(rows.length)check(await db.from('stringeex_calls').upsert(rows,{onConflict:'call_id'}));
    const cursor=result.data?.search_after;const pending=source.length>0&&Array.isArray(cursor)&&cursor.length>0&&JSON.stringify(cursor)!==JSON.stringify(connection.sync_cursor);
    check(await db.from('stringeex_connection').update({sync_cursor:pending?cursor:null,sync_from:pending?from:null,sync_to:pending?to:null,...(!pending?{last_synced_at:new Date(to).toISOString()}:{}),sync_locked_until:null}).eq('id',1).eq('sync_locked_until',lease));
    return json({ok:true,imported:rows.length,pending});
   }finally{await db.from('stringeex_connection').update({sync_locked_until:null}).eq('id',1).eq('sync_locked_until',lease)}
  }
  return json({error:'Unknown action'},400);
 }catch(e){return json({error:e instanceof Error?e.message:'Call sync failed'},400)}
});
