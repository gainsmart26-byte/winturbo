import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"86400"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const endpoint="bytedance/seedance-2.5/text-to-video";
const message=(value:any,fallback:string)=>{const found=value?.detail??value?.message??value?.error;if(typeof found==="string")return found;if(Array.isArray(found))return found.map((item:any)=>item?.msg||item?.message||JSON.stringify(item)).join("; ");if(found&&typeof found==="object")return found.msg||found.message||JSON.stringify(found);return fallback};
const videoUrl=(result:any)=>result?.video?.url||result?.videos?.[0]?.url||result?.data?.video?.url;

async function falJson(key:string,url:string,init:RequestInit={}){
  const response=await fetch(url,{...init,headers:{Authorization:`Key ${key}`,...(init.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(message(data,`FAL request failed (${response.status})`));
  return data;
}

Deno.serve(async(request:Request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(request.method!=="POST")return json({ok:false,error:"POST required"},405);
  try{
    const key=(Deno.env.get("FAL_KEY")||"").trim();
    if(!key)return json({ok:false,error:"FAL_KEY is not configured",error_type:"missing_credentials"},500);
    const auth=request.headers.get("Authorization")||"";
    const supabase=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_ANON_KEY")||"",{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return json({ok:false,error:"Authentication required",error_type:"authentication_required"},401);
    const body=await request.json().catch(()=>({}));
    const action=String(body?.action||"submit").toLowerCase();

    if(action==="status"){
      const requestId=String(body?.request_id||"").trim();
      if(!/^[A-Za-z0-9_-]{8,200}$/.test(requestId))return json({ok:false,error:"Valid request_id is required",error_type:"bad_request"},400);
      const base=`https://queue.fal.run/${endpoint}/requests/${requestId}`;
      const status=await falJson(key,`${base}/status`);
      const state=String(status?.status||"IN_QUEUE").toUpperCase();
      if(state==="COMPLETED"){
        const result=await falJson(key,base);
        const url=videoUrl(result);
        if(!url)throw new Error("Video generation completed without a video URL");
        return json({ok:true,status:"COMPLETED",type:"video",video_url:url,duration:10,model:endpoint});
      }
      if(["FAILED","CANCELLED","CANCELED"].includes(state))return json({ok:false,status:state,error:message(status,`Video generation ${state.toLowerCase()}`),error_type:"generation_failed"},502);
      return json({ok:true,status:state,request_id:requestId,queue_position:status?.queue_position??null});
    }

    if(action!=="submit")return json({ok:false,error:"Unsupported action",error_type:"bad_request"},400);
    const prompt=String(body?.prompt||"").trim();
    if(!prompt)return json({ok:false,error:"prompt is required",error_type:"bad_request"},400);
    const supplied=body?.duration;
    const requested=supplied===undefined||supplied===null||supplied===""?10:Math.round(Number(supplied));
    if(!Number.isFinite(requested)||requested!==10)return json({ok:false,error:"Video duration is fixed at 10 seconds.",error_type:"duration_limit"},400);
    const aspectRatio=String(body?.aspect_ratio||"9:16");
    if(!["21:9","16:9","4:3","1:1","3:4","9:16"].includes(aspectRatio))return json({ok:false,error:"Unsupported aspect ratio",error_type:"bad_request"},400);
    const submitted=await falJson(key,`https://queue.fal.run/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt,duration:"10",aspect_ratio:aspectRatio,resolution:"720p",generate_audio:true,end_user_id:user.id})});
    const requestId=String(submitted?.request_id||"");
    if(!requestId)throw new Error("FAL returned no request_id");
    return json({ok:true,status:"IN_QUEUE",request_id:requestId,duration:10,model:endpoint});
  }catch(error){return json({ok:false,error:error instanceof Error?error.message:String(error),error_type:"generation_failed"},502)}
});
