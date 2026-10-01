import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const message=(value:any,fallback:string)=>{const found=value?.detail??value?.message??value?.error;if(typeof found==="string")return found;if(Array.isArray(found))return found.map((item:any)=>item?.msg||item?.message||JSON.stringify(item)).join("; ");if(found&&typeof found==="object")return found.msg||found.message||JSON.stringify(found);return fallback};

async function runFal(key:string,endpoint:string,input:Record<string,unknown>,timeoutMs=300000){
  const submitted=await fetch(`https://queue.fal.run/${endpoint}`,{method:"POST",headers:{Authorization:`Key ${key}`,"Content-Type":"application/json"},body:JSON.stringify(input)});
  const first=await submitted.json().catch(()=>({}));
  if(!submitted.ok)throw new Error(message(first,`${endpoint} submit failed (${submitted.status})`));
  const requestId=first?.request_id;
  if(!requestId)throw new Error(`${endpoint} returned no request_id`);
  const statusUrl=first?.status_url||`https://queue.fal.run/${endpoint}/requests/${requestId}/status`;
  const responseUrl=first?.response_url||`https://queue.fal.run/${endpoint}/requests/${requestId}`;
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
    await sleep(2500);
    const statusResponse=await fetch(statusUrl,{headers:{Authorization:`Key ${key}`}});
    const status=await statusResponse.json().catch(()=>({}));
    if(!statusResponse.ok)throw new Error(message(status,`${endpoint} status failed`));
    const state=String(status?.status||"").toUpperCase();
    if(state==="COMPLETED"){
      const resultResponse=await fetch(responseUrl,{headers:{Authorization:`Key ${key}`}});
      const result=await resultResponse.json().catch(()=>({}));
      if(!resultResponse.ok)throw new Error(message(result,`${endpoint} result failed`));
      return {result,requestId};
    }
    if(["FAILED","CANCELLED","CANCELED"].includes(state))throw new Error(message(status,`${endpoint} generation ${state.toLowerCase()}`));
  }
  throw new Error(`${endpoint} generation timed out`);
}

const videoUrl=(result:any)=>result?.video?.url||result?.videos?.[0]?.url||result?.data?.video?.url;

Deno.serve(async(request:Request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(request.method!=="POST")return json({ok:false,error:"POST required"},405);
  try{
    const key=(Deno.env.get("FAL_KEY")||"").trim();
    if(!key)return json({ok:false,error:"FAL_KEY is not configured",error_type:"missing_credentials"},500);
    const body=await request.json().catch(()=>({}));
    const prompt=String(body?.prompt||"").trim();
    if(!prompt)return json({ok:false,error:"prompt is required",error_type:"bad_request"},400);
    const requested=Math.round(Number(body?.duration));
    if(!Number.isFinite(requested)||requested<1||requested>60)return json({ok:false,error:"duration must be an integer from 1 to 60 seconds",error_type:"bad_request"},400);
    const aspectRatio=String(body?.aspect_ratio||"9:16");
    const segments:number[]=[];
    let remaining=requested;
    while(remaining>0){segments.push(Math.min(30,remaining));remaining-=segments.at(-1)!}
    const generated=await Promise.all(segments.map(async(seconds,index)=>{
      const nativeSeconds=Math.max(4,seconds);
      const segmentPrompt=segments.length===1?prompt:`${prompt}\nThis is segment ${index+1} of ${segments.length}. Maintain the same subject, wardrobe, lighting and visual direction. ${index===0?"Establish the story.":index===segments.length-1?"Continue naturally and conclude the story.":"Continue the previous action naturally."}`;
      const generation=await runFal(key,"bytedance/seedance-2.5/text-to-video",{prompt:segmentPrompt,duration:String(nativeSeconds),aspect_ratio:aspectRatio,resolution:"720p",generate_audio:true});
      let url=videoUrl(generation.result);
      if(!url)throw new Error("Video generation completed without a video URL");
      if(seconds<nativeSeconds){
        const trimmed=await runFal(key,"fal-ai/workflow-utilities/trim-video",{video_url:url,start_time:0,duration:seconds});
        url=videoUrl(trimmed.result);
        if(!url)throw new Error("Video trim completed without a video URL");
      }
      return url;
    }));
    let finalUrl=generated[0];
    if(generated.length>1){
      const merged=await runFal(key,"fal-ai/ffmpeg-api/merge-videos",{video_urls:generated,resolution_aspect_ratio_video_index:0});
      finalUrl=videoUrl(merged.result);
      if(!finalUrl)throw new Error("Video merge completed without a video URL");
    }
    return json({ok:true,type:"video",video_url:finalUrl,duration:requested,segments:segments.length,model:"bytedance/seedance-2.5/text-to-video"});
  }catch(error){return json({ok:false,error:error instanceof Error?error.message:String(error),error_type:"generation_failed"},502)}
});
