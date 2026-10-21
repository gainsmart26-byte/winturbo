import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)return json({error:'Sign in required'},401);
 const db=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return json({error:'Sign in required'},401);
 const profile=await db.from('profiles').select('role,is_active').eq('id',user.id).single();
 if(profile.error)throw Error('Unable to verify admin access');
 if(profile.data?.role!=='admin'||!profile.data?.is_active)return json({error:'Admin access required'},403);
 const read=async(table,cols,filter)=>{const rows=[];for(let offset=0;;offset+=500){const {data,error}=await filter(db.from(table).select(cols).order('id').range(offset,offset+499));if(error||!Array.isArray(data))throw Error('Unable to read financial analysis');rows.push(...data);if(data.length<500)return rows}};
 const [deposits,withdrawals]=await Promise.all([
 read('admin_deposit_transactions','id,username,credited_amount,requested_at,completed_at',q=>q.eq('status','CREDITED').in('source',['manual','gateway'])),
 read('admin_withdrawal_transactions','id,username,amount',q=>q.in('status',['APPROVED','PAID']))
 ]);
 const players=new Map();
 for(const d of deposits){if(!d.username)continue;const date=d.completed_at||d.requested_at;let p=players.get(d.username);if(!p){p={username:d.username,deposits:0,withdrawals:0,first:date};players.set(d.username,p)}p.deposits+=Number(d.credited_amount)||0;if(date&&(!p.first||date<p.first))p.first=date}
 for(const w of withdrawals){const p=players.get(w.username);if(p)p.withdrawals+=Number(w.amount)||0}
 return json({players:[...players.values()],generated_at:new Date().toISOString()});
 }catch(e){return json({error:e.message||'Analysis unavailable'},500)}
});