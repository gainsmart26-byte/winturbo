import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const groups={daily:'date',sources:'session_source_medium',pages:'page_path',countries:'country',devices:'devicecategory'};
const metrics='totalusers,newusers,sessions,engaged_sessions,screen_page_views';
function dates(b:any){for(const k of ['date_from','date_to']){if(!/^\d{4}-\d{2}-\d{2}$/.test(b[k])||!Number.isFinite(Date.parse(b[k]))||new Date(b[k]).toISOString().slice(0,10)!==b[k])throw Error('Choose valid dates.');}if(b.date_from>b.date_to||(Date.parse(b.date_to)-Date.parse(b.date_from))/86400000>92)throw Error('Choose a date range of up to 93 days.');return {date_from:b.date_from,date_to:b.date_to};}
async function query(key:string,property:string,fields:string,range:any){
 const u=new URL('https://connectors.windsor.ai/googleanalytics4');u.search=new URLSearchParams({api_key:key,select_accounts:property,fields,...range,filter:JSON.stringify([['hostname','eq','winturbo.com'],'or',['hostname','eq','www.winturbo.com']]),_max_rows:'10000'}).toString();
 let r;try{r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(55000)});}catch{throw Error('Google Analytics request timed out. Try again.');}
 if(!r.ok)throw Error(r.status===429?'Windsor rate limit reached. Try again later.':r.status===401||r.status===403?'Windsor denied access. Check the API key and GA4 authorization.':'Analytics provider returned HTTP '+r.status+'. Check your connection and try again.');
 let data;try{data=await r.json();}catch{throw Error('Analytics provider returned an unreadable report.');}
 if(data.error||data.status==='pending'||!Array.isArray(data.data))throw Error('Analytics report is not ready. Confirm the GA4 property is selected in Windsor, then try again.');
 if(data.data.length>=10000)throw Error('Report exceeds 10,000 rows. Choose a shorter date range.');
 return data.data;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
 const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,db=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false}});
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Sign in required'},401);
 const auth=await db.auth.getUser(token);if(auth.error||!auth.data.user)return json({error:'Sign in required'},401);
 const p=await db.from('profiles').select('role,is_active').eq('id',auth.data.user.id).maybeSingle();if(p.error)throw Error('Could not verify access.');if(p.data?.role!=='admin'||!p.data.is_active)return json({error:'Active admin access required'},403);
 if(Number(req.headers.get('content-length'))>16000)return json({error:'Request too large'},413);
 const b=await req.json();if(!['status','connect','report'].includes(b.action))return json({error:'Unknown action'},400);
 const saved=await db.from('google_intell_connection').select('*').eq('id',1).maybeSingle();if(saved.error)throw Error('Google Intell storage is unavailable.');
 const connection=saved.data;
 if(b.action==='status')return json({connected:!!connection,property_id:connection?.property_id||null,hostname:'winturbo.com'});
 const cryptoKey=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret+':google-intell-v1')),'AES-GCM',false,['encrypt','decrypt']);
 if(b.action==='connect'){
 const key=String(b.api_key||'').trim(),property=String(b.property_id||'').trim();if(key.length<10||key.length>10000||!/^\d{1,20}$/.test(property))throw Error('Enter your Windsor API key and numeric GA4 property ID.');
 // Validate provider access before replacing the saved connection. An empty report is valid.
 await query(key,property,'sessions',{date_preset:'last_7d'});
 const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},cryptoKey,new TextEncoder().encode(key)));
 const result=await db.from('google_intell_connection').upsert({id:1,property_id:property,ciphertext:btoa(String.fromCharCode(...iv,...cipher)),updated_by:auth.data.user.id,updated_at:new Date().toISOString()});if(result.error)throw Error('Could not save the connection.');return json({connected:true,property_id:property,hostname:'winturbo.com'});
 }
 if(!connection)return json({error:'Connect Google Analytics in the connection panel first.',code:'NOT_CONNECTED'},409);
 if(!Object.hasOwn(groups,b.group_by))throw Error('Unsupported breakdown.');const range=dates(b),dimension=groups[b.group_by as keyof typeof groups];
 const bytes=Uint8Array.from(atob(connection.ciphertext),c=>c.charCodeAt(0));let key;try{key=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},cryptoKey,bytes.slice(12)));}catch{throw Error('Reconnect Google Analytics to renew the saved API key.');}
 // Separate totals query avoids adding distinct users across days or dimension rows.
 const [totals,rows]=await Promise.all([query(key,connection.property_id,metrics,range),query(key,connection.property_id,dimension+','+metrics,range)]);
 if(totals.length>1)throw Error('Unexpected totals response. No report has been displayed.');
 return json({connected:true,property_id:connection.property_id,hostname:'winturbo.com',...range,group_by:b.group_by,dimension,totals:totals[0]||null,rows,fetched_at:new Date().toISOString()});
 }catch(e){return json({error:e instanceof Error?e.message:'Google Analytics request failed'},400);}
});
