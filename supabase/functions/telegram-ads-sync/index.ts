import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-telegram-scheduler','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const num=(x:unknown)=>{const n=Number(x??0);if(!Number.isFinite(n)||n<0)throw Error('Telegram returned an invalid metric.');return n;};
async function api(key:string,method:string,body:Record<string,unknown>={}){
 const r=await fetch('https://promoteapi.telegram.org/'+method,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 let v;try{v=await r.json()}catch{throw Error('Telegram returned an unreadable response (HTTP '+r.status+').')}
 if(!r.ok||v.ok!==true){const e=typeof v.error==='string'&&/^[A-Z0-9_]+$/.test(v.error)?v.error:'HTTP_'+r.status;throw Error('Telegram Ads '+method+' failed: '+e);}
 return v.result;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 let locked=false;
 try{
  const control=await db.from('telegram_ads_sync_control').select('*').eq('id',1).single();
  if(control.error)throw Error('Telegram sync configuration is unavailable.');
  const scheduler=req.headers.get('x-telegram-scheduler');
  const scheduled=!!scheduler&&await digest(scheduler)===control.data.scheduler_hash;
  if(!scheduled){
   const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
   if(!token)return json({error:'Sign in required'},401);
   const a=await db.auth.getUser(token);if(a.error||!a.data.user)return json({error:'Sign in required'},401);
   const p=await db.from('profiles').select('role,is_active').eq('id',a.data.user.id).maybeSingle();
   if(p.error||!p.data?.is_active||p.data.role!=='admin')return json({error:'Active admin access required'},403);
  }
  const b=await req.json();
  if(b.action==='status')return json({configured:!!Deno.env.get('TELEGRAM_ADS_API_KEY'),last_error:control.data.last_error,last_success_at:control.data.last_success_at});
  if(!['sync','scheduled_sync'].includes(b.action))return json({error:'Unknown action'},400);
  const key=Deno.env.get('TELEGRAM_ADS_API_KEY')?.trim();if(!key)throw Error('TELEGRAM_ADS_API_KEY is missing from Edge Function Secrets.');
  const configuredUrl=Deno.env.get('TELEGRAM_ADS_API_URL')?.trim().replace(/\/$/,'');
  if(configuredUrl&&configuredUrl!=='https://promoteapi.telegram.org')throw Error('TELEGRAM_ADS_API_URL must be https://promoteapi.telegram.org.');
  // One caller at a time. Expire abandoned locks after five minutes.
  const now=new Date().toISOString();
  const lock=await db.from('telegram_ads_sync_control').update({running_since:now}).eq('id',1).or('running_since.is.null,running_since.lt.'+new Date(Date.now()-300000).toISOString()).select('id');
  if(lock.error)throw Error('Could not start Telegram sync.');
  if(!lock.data?.length)return json({error:'Telegram sync is already running. Reload shortly.'},409);
  locked=true;
  const end=new Date();end.setUTCHours(0,0,0,0);end.setUTCDate(end.getUTCDate()+1);
  const start=new Date(end);start.setUTCDate(start.getUTCDate()-30);
  let from=start.toISOString().slice(0,10),to=new Date(end.getTime()-86400000).toISOString().slice(0,10);
  if(!scheduled&&b.date_from&&b.date_to){
   for(const v of [b.date_from,b.date_to])if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Choose valid report dates.');
   if(b.date_from>b.date_to||(Date.parse(b.date_to)-Date.parse(b.date_from))/86400000>92||b.date_to>to)throw Error('Choose up to 93 days, ending no later than today (UTC).');
   from=b.date_from;to=b.date_to;
  }
  const account=await api(key,'getCurrentAccount');
  if(!account?.account_id||!account.title||!['EUR','TON','XTR'].includes(account.currency))throw Error('Telegram account response is incomplete.');
  const ads:any[]=[];let offset='';const seen=new Set<string>();
  for(let page=0;page<100;page++){
   const r=await api(key,'getAdsList',{limit:100,...(offset?{offset}:{})});
   if(!Array.isArray(r?.ads))throw Error('Telegram ad list response is incomplete.');
   ads.push(...r.ads);
   if(!r.next_offset)break;
   if(seen.has(r.next_offset)||page===99)throw Error('Telegram ad pagination did not complete.');
   seen.add(r.next_offset);offset=r.next_offset;
  }
  // Fetch all source data before writing; do not advance freshness on a failed fetch.
  const fetched:any[]=[];
  for(const ad of ads){
   if(!Number.isSafeInteger(ad.ad_id))throw Error('Telegram returned an invalid ad identifier.');
   const stats=await api(key,'getAdStats',{ad_id:ad.ad_id,from_time:Date.parse(from)/1000,to_time:Date.parse(to)/1000+86400,interval:86400});
   if(!Array.isArray(stats))throw Error('Telegram daily stats response is incomplete.');
   for(const d of stats){if(!Number.isFinite(d.from_time)||d.from_time%86400!==0||d.currency!==account.currency)throw Error('Telegram daily stats use an unexpected date or currency.');}
   fetched.push({ad,stats});
  }
  const existing=await db.from('telegram_ad_accounts').select('id,account_name,external_account_id').or('external_account_id.eq.'+String(account.account_id)+',account_name.eq.'+account.title);
  if(existing.error)throw Error('Could not match the advertiser account.');
  const matched=existing.data?.find(x=>x.external_account_id===String(account.account_id))||existing.data?.find(x=>!x.external_account_id&&x.account_name===account.title);
  if(existing.data?.some(x=>x.account_name===account.title&&x.external_account_id&&x.external_account_id!==String(account.account_id)))throw Error('Account name belongs to another advertiser. No data changed.');
  const saved=await db.from('telegram_ad_accounts').upsert({...matched&&{id:matched.id},account_name:account.title,external_account_id:String(account.account_id),currency:account.currency,available_balance:num(account.remaining_budget),connection_status:'attention',updated_at:now}, {onConflict:'account_name'}).select('id').single();
  if(saved.error)throw Error('Could not save the advertiser account.');
  let dailyCount=0;
  for(const {ad,stats} of fetched){
   const row=await db.from('telegram_ads').upsert({account_id:saved.data.id,external_ad_id:String(ad.ad_id),title:ad.title,destination_url:ad.promote_url,status:ad.is_paused?'paused':ad.status,source_created_at:new Date(ad.created_date*1000).toISOString(),cpm:num(ad.cpm),remaining_budget:num(ad.remaining_budget),views:num(ad.views),clicks:num(ad.clicks),joined:num(ad.actions??ad.joins),last_synced_at:now,updated_at:now},{onConflict:'account_id,external_ad_id'}).select('id').single();
   if(row.error)throw Error('Could not save Telegram ad '+ad.ad_id+'.');
   // Write zeros for missing source intervals to replace older imported values accurately.
   const byDate=new Map(stats.map((d:any)=>[new Date(d.from_time*1000).toISOString().slice(0,10),d]));
   const rows=[];
   for(let t=Date.parse(from);t<=Date.parse(to);t+=86400000){const date=new Date(t).toISOString().slice(0,10),d:any=byDate.get(date);rows.push({ad_id:row.data.id,metric_date:date,views:num(d?.views),clicks:num(d?.clicks),joined:num(d?.actions??d?.joins),spend:num(d?.spent_budget),synced_at:now});}
   const daily=await db.from('telegram_ad_daily').upsert(rows,{onConflict:'ad_id,metric_date'});
   if(daily.error)throw Error('Could not save daily statistics for Telegram ad '+ad.ad_id+'.');
   dailyCount+=rows.length;
  }
  const done=await db.from('telegram_ad_accounts').update({connection_status:'connected',last_synced_at:now,updated_at:now}).eq('id',saved.data.id);
  if(done.error)throw Error('Could not finish Telegram sync.');
  const state=await db.from('telegram_ads_sync_control').update({running_since:null,last_error:null,last_success_at:now}).eq('id',1);
  if(state.error)throw Error('Could not update Telegram sync status.');
  locked=false;
  return json({ok:true,account_name:account.title,currency:account.currency,ads:ads.length,daily_rows:dailyCount,date_from:from,date_to:to,synced_at:now,daily_timezone:'UTC'});
 }catch(e){
  const error=e instanceof Error?e.message:'Telegram sync failed.';
  if(locked)await db.from('telegram_ads_sync_control').update({running_since:null,last_error:error}).eq('id',1);
  return json({error},400);
 }
});
