import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import './core.js';
const C=(globalThis as any).TrafficStarsCore;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const check=(r:any)=>{if(r.error)throw Error('TrafficStars storage is unavailable.');return r.data;};
const base='https://api.trafficstars.com';
async function upstream(path:string,options:any){
 let response;try{response=await fetch(base+path,{...options,redirect:'error',signal:AbortSignal.timeout(25000)});}catch{throw Error('TrafficStars could not be reached. Try again later.');}
 if(!response.ok)throw Error(response.status===429?'TrafficStars rate limit reached. Try again later.':response.status===401||response.status===403?'TrafficStars denied access. Check your API key and permissions.':`TrafficStars returned HTTP ${response.status}. Try again later.`);
 let data;try{data=await response.json();}catch{throw Error('TrafficStars returned an unreadable response.');}return data;
}
async function accessToken(apiKey:string){const data=await upstream('/v1/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:apiKey})});if(typeof data.access_token!=='string'||!data.access_token)throw Error('TrafficStars did not return an access token.');return data.access_token;}
async function campaigns(token:string){const data=await upstream('/v1.1/campaigns',{headers:{Authorization:'Bearer '+token}});if(!Array.isArray(data.response)||data.response.length>10000||Number(data.page_count||1)>1)throw Error('Unrecognized or incomplete TrafficStars campaign list.');return data.response.filter((r:any)=>!r.is_archived).map((r:any)=>({id:Number(r.id),name:String(r.name||r.id).slice(0,250),status:String(r.status||''),active:r.active===true,approved:String(r.approved||''),no_funds:r.no_funds===true,type:String(r.type||''),format_id:r.format_id}));}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
 const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,db=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false}});
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Sign in required'},401);
 const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return json({error:'Sign in required'},401);
 const profile=check(await db.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle());if(profile?.role!=='admin'||!profile.is_active)return json({error:'Active admin access required'},403);
 if(Number(req.headers.get('content-length'))>20000)return json({error:'Request too large'},413);
 const b=await req.json();if(!['status','connect','report'].includes(b.action))return json({error:'Unknown action'},400);
 const connection=check(await db.from('trafficstars_connection').select('*').eq('id',1).maybeSingle());
 if(b.action==='status')return json({connected:!!connection,label:connection?.label||null,currency:connection?.currency||'USD',updated_at:connection?.updated_at||null});
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret+':trafficstars-v1')),'AES-GCM',false,['encrypt','decrypt']);
 const encrypt=async(value:string)=>{const iv=crypto.getRandomValues(new Uint8Array(12)),data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value)));return btoa(String.fromCharCode(...iv,...data));};
 const decrypt=async(value:string)=>{try{const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},key,bytes.slice(12)));}catch{throw Error('Reconnect TrafficStars to renew the saved API key.');}};
 if(b.action==='connect'){
 const apiKey=String(b.api_key||'').trim(),label=String(b.label||'WinTurbo').trim(),currency=String(b.currency||'USD');if(apiKey.length<10||apiKey.length>10000||!label||label.length>100||!['USD','EUR','INR','GBP'].includes(currency))throw Error('Enter a valid API key, label and account currency.');
 const access=await accessToken(apiKey);const list=await campaigns(access);
 // Validate before replacement; credential and identity are committed together.
 check(await db.from('trafficstars_connection').upsert({id:1,label,currency,ciphertext:await encrypt(apiKey),updated_by:user.id,updated_at:new Date().toISOString()}));
 check(await db.from('trafficstars_reports').delete().neq('report_key',''));
 return json({ok:true,connected:true,label,currency,campaign_count:list.length});
 }
 if(!connection)return json({error:'Connect your TrafficStars API key first.',code:'NOT_CONNECTED'},409);
 const dates=C.range(b.date_from,b.date_to),group=String(b.group_by||'campaign');if(!['campaign','date','creative','country','device','spot'].includes(group))throw Error('Unsupported report grouping.');
 const ids=b.campaigns??[];if(!Array.isArray(ids)||ids.length>10000||ids.some((id:any)=>!Number.isSafeInteger(id)||id<1))throw Error('Invalid campaign filter.');
 const reportKey=JSON.stringify([connection.updated_at,dates.date_from,dates.date_to,group,[...ids].sort((a,b)=>a-b)]);
 if(b.refresh!==true){const cached=check(await db.from('trafficstars_reports').select('payload,fetched_at').eq('report_key',reportKey).maybeSingle());if(cached)return json({...cached.payload,fetched_at:cached.fetched_at,cached:true});}
 const access=await accessToken(await decrypt(connection.ciphertext));
 const [raw,list]=await Promise.all([upstream('/v2/campaigns/statistics',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({...dates,group_by:group,...(ids.length?{campaigns:ids}:{}),show_archived:false})}),campaigns(access)]);
 const items=C.rows(raw);if(group==='campaign'){
 const byId=new Map(items.map((r:any)=>[r.id,r]));for(const campaign of list){if(ids.length&&!ids.includes(campaign.id))continue;const existing:any=byId.get(String(campaign.id));if(existing){existing.name=campaign.name;existing.status=campaign.status;existing.approval_status=campaign.approved;existing.no_funds=campaign.no_funds;}else items.push({id:String(campaign.id),name:campaign.name,status:campaign.status,approval_status:campaign.approved,no_funds:campaign.no_funds,ad_type:campaign.type,has_rejected_creatives:false,impressions:0,clicks:0,spend:0,conversions:null,revenue:null});}
 }
 const fetched_at=new Date().toISOString(),payload={ok:true,rows:items,campaigns:list,currency:connection.currency,label:connection.label,group_by:group,...dates};
 check(await db.from('trafficstars_reports').upsert({report_key:reportKey,payload,fetched_at}));return json({...payload,fetched_at,cached:false});
 }catch(e){return json({error:e instanceof Error?e.message:'TrafficStars request failed'},400);}
});
