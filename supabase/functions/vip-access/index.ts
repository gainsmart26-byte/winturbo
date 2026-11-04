import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const origins=new Set(['https://winturbo.vip','https://www.winturbo.vip']);
export function normalizePhone(value:unknown){
 const digits=String(value||'').replace(/[\s()+-]/g,'');
 const phone=digits.length===10?'91'+digits:digits;
 return /^91[6-9]\d{9}$/.test(phone)?phone:null;
}
export async function handle(req:Request){
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'null','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'apikey,content-type,authorization'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!origins.has(origin))return reply({error:'Website not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Method not allowed.'},405);
 try{
  const raw=await req.text();if(raw.length>1024)return reply({error:'Request too large.'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid request.'},400)}
  const phone=normalizePhone(body.phone);if(!phone)return reply({error:'Enter a valid Indian mobile number.'},400);
  const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
  const bucket=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const quota=await db.rpc('turboman_take_quota',{p_bucket:'vip-phone:'+bucket,p_limit:60});
  if(quota.error)return reply({error:'Verification is temporarily unavailable. Please try again.'},503);
  if(!quota.data)return reply({error:'Too many checks. Please try again later.'},429);
  const member=await db.rpc('turboman_verified_player',{p_phone:phone});
  if(member.error)return reply({error:'Could not check registration. Please try again.'},503);
  // This grants access to the public VIP support page only. It is NOT an account identity.
  // Return no member names, account details, tokens or balances.
  return reply({registered:Array.isArray(member.data)&&member.data.length>0});
 }catch{return reply({error:'Could not check registration. Please try again.'},503)}
}
Deno.serve(handle);
