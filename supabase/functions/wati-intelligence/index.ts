import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import './core.js';
const C=(globalThis as any).WhatsAppIntelligenceCore;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const check=(r:any)=>{if(r.error)throw Error('Database operation failed. Contact admin support.');return r.data};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,db=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false}});
 try{
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Sign in required'},401);
 const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return json({error:'Sign in required'},401);
 const p=check(await db.from('profiles').select('role,is_active').eq('id',user.id).single());if(p?.role!=='admin'||!p.is_active)return json({error:'Admin access required'},403);
 const b=await req.json();
 if(b.action==='performance_financials'){
 // Financial ledgers stay server-only. Return aggregates after the active-admin check above.
 const grouped:Record<string,number>={};let deposits=0;
 for(const table of ['admin_withdrawal_transactions','admin_deposit_transactions']){
 for(let offset=0;;offset+=500){
 const cols=table==='admin_deposit_transactions'?'id,status,credited_amount,source':'id,status,amount';
 const rows=check(await db.from(table).select(cols).order('id').range(offset,offset+499));if(!Array.isArray(rows))throw Error('Financial data unavailable.');
 for(const row of rows){if(table==='admin_deposit_transactions'){if(row.status==='CREDITED'&&row.source!=='agent_credit')deposits+=Number(row.credited_amount)||0;}else if(['APPROVED','PROCESSING','PAID','COMPLETED','SUCCESS'].includes(row.status)){grouped[row.status]=(grouped[row.status]||0)+(Number(row.amount)||0)}}
 if(rows.length<500)break;
 }
 }
 return json({deposits,withdrawals:Object.entries(grouped).map(([status,amount])=>({status,amount})),generated_at:new Date().toISOString()});
 }

 // Only this gateway reads encrypted credentials; RLS grants no client access to that table.
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret+':wati-v1')),'AES-GCM',false,['encrypt','decrypt']);
 const encrypt=async(value:string)=>{const iv=crypto.getRandomValues(new Uint8Array(12)),data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value)));return btoa(String.fromCharCode(...iv,...data))};
 const decrypt=async(value:string)=>{const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},key,bytes.slice(12)))};
 if(b.action==='save'){
 const label=String(b.label||'').trim(),number=C.phone(b.business_number),base=C.endpoint(b.endpoint),apiToken=String(b.api_token||'').replace(/^Bearer\s+/i,'').trim();if(!label||label.length>100||!number)throw Error('Enter an account label and valid business phone number.');if(!apiToken||apiToken.length>10000)throw Error('Enter the WATI API token.');
 const existing=check(await db.from('wati_connections').select('id').eq('endpoint',base).eq('business_number',number).maybeSingle());
 const connection=check(await db.from('wati_connections').upsert({...(existing?{id:existing.id}:{}),label,business_number:number,endpoint:base,created_by:user.id},{onConflict:'endpoint,business_number'}).select('id').single());
 check(await db.from('wati_credentials').upsert({connection_id:connection.id,ciphertext:await encrypt(apiToken)}));return json({ok:true,id:connection.id});
 }
 if(b.action==='list')return json({connections:check(await db.from('wati_connections').select('id,label,business_number,endpoint,last_synced_at,next_page,last_error,created_at').order('created_at'))});
 if(!['sync','messages'].includes(b.action))throw Error('Unknown action');
 const connection=check(await db.from('wati_connections').select('*').eq('id',b.connection_id).single()),credential=check(await db.from('wati_credentials').select('ciphertext').eq('connection_id',connection.id).single());
 let apiToken;try{apiToken=await decrypt(credential.ciphertext)}catch{throw Error('Please reconnect this WATI account to renew its saved token.')}
 if(b.action==='messages'){
 const normalized=C.phone(b.phone),page=Number(b.page||1);if(!normalized||!Number.isInteger(page)||page<1||page>100)throw Error('Invalid contact or message page.');
 const contact=check(await db.from('wati_contacts').select('contact_id,phone').eq('connection_id',connection.id).eq('phone',normalized).maybeSingle());if(!contact)return json({error:'Contact is not part of this WATI account.'},404);
 // Contact IDs preserve international identity; never infer an unverified country prefix.
 const target=contact.contact_id;if(!target)throw Error('Contact identity is missing. Sync contacts again.');
 const url=new URL(C.endpoint(connection.endpoint)+'/api/v1/getMessages/'+encodeURIComponent(target));url.searchParams.set('pageSize','100');url.searchParams.set('pageNumber',String(page));
 const response=await fetch(url,{headers:{Authorization:'Bearer '+apiToken,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(response.status===429?'WATI rate limit reached. Try again later.':response.status===403?'WATI denied conversation access. Check conversations:read permission, workspace role and plan.':`WATI messages returned HTTP ${response.status}.`);
 const data=await response.json();if(data.result===false)throw Error('WATI rejected the message-history request.');
 const raw=Array.isArray(data.messages)?data.messages:data.messages?.items;if(!Array.isArray(raw)||raw.length>100)throw Error('Unrecognized WATI message history. No response-time values calculated.');
 const messages=raw.map((m:any)=>({id:String(m.id||m.whatsappMessageId||''),created:m.created,timestamp:m.timestamp,owner:m.owner,type:m.type,statusString:m.statusString,eventType:m.eventType??m.event_type,isAutomated:m.isAutomated,isFromBot:m.isFromBot,operatorName:typeof m.operatorName==='string'?m.operatorName.slice(0,100):null}));
 // Never follow API-returned URLs, and never return message text to this analytics screen.
 const link=data.link??data.messages?.link;const more=link&&Object.prototype.hasOwnProperty.call(link,'nextPage')?!!link.nextPage:raw.length===100;
 return json({ok:true,page,more,messages,checked_at:new Date().toISOString()});
 }
 const page=connection.next_page||1,base=C.endpoint(connection.endpoint),url=new URL(base+'/api/v1/getContacts');url.searchParams.set('pageNumber',String(page));url.searchParams.set('pageSize','100');
 try{
 const response=await fetch(url,{headers:{Authorization:'Bearer '+apiToken,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(response.status===429?'WATI rate limit reached. Resume sync later.':`WATI returned HTTP ${response.status}. Check API access and token.`);
 let data;try{data=await response.json()}catch{throw Error('WATI returned an unreadable response. No page saved.')}
 const raw=C.contactPage(data),parsed=C.contactRows(raw);if(raw.length>100)throw Error('Unexpected WATI page size; no page saved.');
 const done=raw.length<100;
 const result=check(await db.rpc('ingest_wati_page',{p_connection:connection.id,p_page:page,p_contacts:parsed.rows,p_done:done}));
 return json({ok:true,done,page,imported:parsed.rows.length,invalid:parsed.invalid,result});
 }catch(e){const message=e instanceof Error?e.message:'WATI sync failed';await db.from('wati_connections').update({last_error:message.slice(0,200)}).eq('id',connection.id);throw e}
 }catch(e){return json({error:e instanceof Error?e.message:'Request failed'},400)}
});
