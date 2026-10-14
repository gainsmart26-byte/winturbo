import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SHEET_ID="1rU1CYXzv72sVrh00tzBvcX-BFU6TU6VDPF84OD2xdEE";
const CSV_URL=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const headerIndex=(headers:string[],...aliases:string[])=>{
  const normalized=headers.map(value=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g," ").trim());
  return normalized.findIndex(value=>aliases.includes(value));
};
function csv(t:string){const z:string[][]=[];let r:string[]=[],v="",q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c=='"'&&t[i+1]=='"'){v+='"';i++}else if(c=='"')q=false;else v+=c}else if(c=='"')q=true;else if(c==','){r.push(v);v=''}else if(c=='\n'){r.push(v.replace(/\r$/,''));z.push(r);r=[];v=''}else v+=c}if(v||r.length){r.push(v.replace(/\r$/,''));z.push(r)}return z}
function sheetDate(v:string){const s=(v||"").trim();if(!s)return null;let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m)return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;return null}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const auth=req.headers.get("Authorization")||"",token=auth.replace(/^Bearer\s+/i,"");
    if(!token) return Response.json({ok:false,error:"Authentication required"},{status:401,headers:cors});
    const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:userData,error:userError}=await sb.auth.getUser(token);
    if(userError||!userData.user)return Response.json({ok:false,error:"Invalid session"},{status:401,headers:cors});
    const {data:profile}=await sb.from("profiles").select("role,is_active").eq("id",userData.user.id).maybeSingle();
    if(!profile?.is_active||profile.role!=="admin")return Response.json({ok:false,error:"Admin access required"},{status:403,headers:cors});
    const res=await fetch(CSV_URL,{headers:{"cache-control":"no-cache"}});
    if(!res.ok)throw new Error(`Google Sheet HTTP ${res.status}`);
    const rows=csv(await res.text()),h=(rows.shift()||[]).map(x=>x.trim());
    const ei=headerIndex(h,"expense type","expense","type"),ai=headerIndex(h,"amount","expense amount","cost"),pi=headerIndex(h,"purpose","category","description"),di=headerIndex(h,"date","expense date","spend date");
    if(ei<0||ai<0||pi<0)throw new Error(`Required columns not found. Received: ${h.filter(Boolean).join(", ")||"empty header row"}`);
    const now=new Date().toISOString();
    const data=rows.map((x,i)=>{const et=(x[ei]||"").trim(),purpose=(x[pi]||"").trim(),amount=Number(String(x[ai]||"0").replace(/[^0-9.-]/g,""))||0;return{source_key:`expense-sheet-row-${i+2}`,expense_type:et,amount,purpose,category:purpose||"Other",source_sheet:"Expense Sheet",source_row:i+2,expense_date:di>=0?sheetDate(x[di]):null,synced_at:now,updated_at:now}}).filter(x=>x.expense_type||x.amount||x.purpose);
    const replaced=await sb.rpc("replace_expense_sheet_rows",{p_rows:data});
    if(replaced.error)throw new Error(`Database replace failed: ${replaced.error.message}`);
    return Response.json({ok:true,rows:data.length,total:data.reduce((a,x)=>a+x.amount,0),synced_at:now},{headers:{...cors,"cache-control":"no-store"}});
  }catch(e){console.error("sync-expenses failed",e);return Response.json({ok:false,error:e?.message||String(e)},{status:500,headers:cors})}
});
