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
 if(b.action!=='sync')throw Error('Unknown action');
 const connection=check(await db.from('wati_connections').select('*').eq('id',b.connection_id).single()),credential=check(await db.from('wati_credentials').select('ciphertext').eq('connection_id',connection.id).single());
 let apiToken;try{apiToken=await decrypt(credential.ciphertext)}catch{throw Error('Please reconnect this WATI account to renew its saved token.')}
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
