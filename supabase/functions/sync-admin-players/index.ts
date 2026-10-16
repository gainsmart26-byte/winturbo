import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
function errorMessage(error:unknown):string {
  if(error instanceof Error)return error.message;
  if(error && typeof error==="object"){
    const e=error as {message?:unknown;code?:unknown};
    if(typeof e.message==="string")return (typeof e.code==="string"?e.code+": ":"")+e.message;
  }
  return typeof error==="string"?error:"Sync failed; no readable error was returned";
}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function apiFetch(url:URL,apiKey:string){
  let response:Response|null=null;
  for(let attempt=0;attempt<4;attempt++){
    response=await fetch(url,{headers:{"X-API-Key":apiKey,"Accept":"application/json"}});
    if(response.status!==429&&response.status<500)break;
    await sleep(Math.min(Number(response.headers.get("Retry-After")||2**attempt),15)*1000);
  }
  if(!response?.ok)throw new Error(`Admin API ${response?.status||500}: ${response?await response.text():"No response"}`.slice(0,600));
  return response.json();
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const supabaseUrl=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey=Deno.env.get("PLAYER_API_KEY")||Deno.env.get("WINTURBO_ADMIN_API_KEY")||Deno.env.get("ADMIN_API_KEY");
  const baseUrl=(Deno.env.get("PLAYER_API_BASE_URL")||Deno.env.get("WINTURBO_ADMIN_API_URL")||"https://admin.winturbo.com/api/v1").replace(/\/$/,"");
  if(!apiKey)return json({error:"Player API secret is not configured",expectedSecret:"PLAYER_API_KEY"},503);
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authError}=await admin.auth.getUser(token);
  if(authError||!authData.user)return json({error:"Unauthorized"},401);
  const {data:profile}=await admin.from("profiles").select("role,is_active").eq("id",authData.user.id).maybeSingle();
  if(!profile?.is_active||profile.role!=="admin")return json({error:"Admin access required"},403);
  await admin.from("admin_player_sync_state").update({last_sync_started_at:new Date().toISOString(),last_status:"running",last_error:null,players_processed:0,updated_at:new Date().toISOString()}).eq("id",true);
  try{
    const {data:state}=await admin.from("admin_player_sync_state").select("last_server_time").eq("id",true).single();
    let cursor:string|null=null,serverTime:string|null=null,processed=0,pages=0;
    do{
      const url=new URL(baseUrl+"/players");url.searchParams.set("limit","1000");
      if(state?.last_server_time)url.searchParams.set("updatedSince",state.last_server_time);if(cursor)url.searchParams.set("cursor",cursor);
      const body=await apiFetch(url,apiKey);if(!Array.isArray(body.data))throw new Error("Player API returned an invalid data payload");
      if(!serverTime&&body.serverTime)serverTime=body.serverTime;
      const rows=[];
      for(const player of body.data){
        rows.push({username:player.username,phone:player.phone??null,email:player.email??null,registered_at:player.registeredAt,status:player.status,
          ftd:Boolean(player.ftd),ftd_at:player.ftdAt??null,last_deposit_at:player.lastDepositAt??null,lifetime_deposits:Number(player.lifetimeDeposits||0),
          deposit_count:Number(player.depositCount||0),deposits_today_count:Number(player.depositsToday?.count||0),deposits_today_amount:Number(player.depositsToday?.amount||0),
          withdrawal_count:Number(player.withdrawalCount||0),lifetime_withdrawals:Number(player.lifetimeWithdrawals||0),ggr:Number(player.ggr||0),ngr:Number(player.ngr||0),
          agent:player.agent??null,upline:Array.isArray(player.upline)?player.upline:[],signup_ip:null,last_login_ip:null,
          signup_country:player.signupCountry??player.country??null,signup_region:player.signupRegion??player.region??null,signup_city:player.signupCity??player.city??null,
          source_updated_at:player.updatedAt,synced_at:new Date().toISOString()});
      }
      if(rows.length){const {error}=await admin.rpc("sync_admin_player_rows",{payload:rows});if(error)throw error;}
      processed+=rows.length;pages++;cursor=body.hasMore?body.nextCursor:null;if(pages>10000)throw new Error("Pagination safety limit reached");
    }while(cursor);

    const to=new Date(),from=new Date(to.getTime()-31*86400000);
    async function syncTransactions(kind:"deposits"|"withdrawals"){
      let next:string|null=null,count=0,pageCount=0;
      do{
        const url=new URL(`${baseUrl}/${kind}`);url.searchParams.set("from",from.toISOString());url.searchParams.set("to",to.toISOString());url.searchParams.set("limit","1000");if(next)url.searchParams.set("cursor",next);
        const body=await apiFetch(url,apiKey);if(!Array.isArray(body.data))throw new Error(`${kind} API returned an invalid data payload`);
        const invalid=body.data.filter((x:any)=>typeof x?.username!=="string"||!x.username.trim()).length;
        if(invalid)throw new Error(`${kind} API returned ${invalid} transaction(s) without a username on page ${pageCount+1}. The API must provide username before these transactions can be imported. Sync is incomplete; no records from this page were saved.`);
        const rows=body.data.map((x:any)=>kind==="deposits"?{id:x.id,username:x.username,amount:Number(x.amount||0),credited_amount:Number(x.creditedAmount||0),status:x.status,source:x.source,requested_at:x.requestedAt,completed_at:x.completedAt??null,synced_at:new Date().toISOString()}:{id:x.id,username:x.username,amount:Number(x.amount||0),status:x.status,source:x.source,requested_at:x.requestedAt,reviewed_at:x.reviewedAt??null,synced_at:new Date().toISOString()});
        if(rows.length){const {error}=await admin.from(kind==="deposits"?"admin_deposit_transactions":"admin_withdrawal_transactions").upsert(rows,{onConflict:"id"});if(error)throw error;}
        count+=rows.length;pageCount++;next=body.hasMore?body.nextCursor:null;if(pageCount>1000)throw new Error(`${kind} pagination safety limit reached`);
      }while(next);
      return count;
    }
    const deposits=await syncTransactions("deposits"),withdrawals=await syncTransactions("withdrawals");
    await admin.from("admin_player_sync_state").update({last_server_time:serverTime||state?.last_server_time||null,last_sync_completed_at:new Date().toISOString(),last_status:"success",last_error:null,players_processed:processed,updated_at:new Date().toISOString()}).eq("id",true);
    return json({ok:true,processed,pages,deposits,withdrawals,serverTime,transactionWindowDays:31});
  }catch(error){
    const message=errorMessage(error);
    await admin.from("admin_player_sync_state").update({last_sync_completed_at:new Date().toISOString(),last_status:"error",last_error:message.slice(0,1000),updated_at:new Date().toISOString()}).eq("id",true);
    return json({error:message},502);
  }
});
