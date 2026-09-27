import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json"}});
Deno.serve(async(request)=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(request.method!=="POST")return json({ok:false,error:"POST required"},405);
 const supabaseUrl=Deno.env.get("SUPABASE_URL")||"",anonKey=Deno.env.get("SUPABASE_ANON_KEY")||"",serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",openaiKey=Deno.env.get("OPENAI_API_KEY")||"";
 if(!supabaseUrl||!anonKey||!serviceKey||!openaiKey)return json({ok:false,error:"Voiceover service is not configured"},500);
 const authorization=request.headers.get("authorization")||"";
 const authClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const{data:{user},error:authError}=await authClient.auth.getUser();
 if(authError||!user)return json({ok:false,error:"Sign in required"},401);
 const body=await request.json().catch(()=>({})),input=String(body.script||"").trim(),voice=String(body.voice||"coral");
 const supported=new Set(["alloy","ash","ballad","coral","echo","fable","onyx","nova","sage","shimmer","verse","marin","cedar"]);
 if(!input)return json({ok:false,error:"Voiceover script is required"},400);
 if(input.length>4096)return json({ok:false,error:"Voiceover script must be 4,096 characters or fewer"},400);
 if(!supported.has(voice))return json({ok:false,error:"Unsupported voice"},400);
 const speech=await fetch("https://api.openai.com/v1/audio/speech",{method:"POST",headers:{Authorization:`Bearer ${openaiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini-tts",voice,input,instructions:String(body.instructions||"Natural Indian English delivery. Clear, energetic and suitable for social media. Do not imitate a real person."),response_format:"mp3"})});
 if(!speech.ok){const detail=await speech.text();return json({ok:false,error:`AI voice generation failed (${speech.status})`,detail:detail.slice(0,400)},502)}
 const bytes=new Uint8Array(await speech.arrayBuffer()),path=`manual/${user.id}/voiceover-${crypto.randomUUID()}.mp3`;
 const db=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}}),upload=await db.storage.from("generated-media").upload(path,bytes,{contentType:"audio/mpeg",upsert:false});
 if(upload.error)return json({ok:false,error:upload.error.message},500);
 const{data}=db.storage.from("generated-media").getPublicUrl(path);
 return json({ok:true,audio_url:data.publicUrl,voice,ai_generated:true});
});
