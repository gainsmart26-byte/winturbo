import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({ok:false,error:'POST required'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user}}=await client.auth.getUser();if(!user)return json({ok:false,error:'Authentication required'},401);
  const body=await req.json(),admin=createClient(url,key);
  const {data:q,error}=await admin.from('publishing_queue').select('*').eq('id',body.queue_id).single();
  if(error||!q||q.platform!=='instagram'||q.publishing_account_id!=='b1085af0-bafa-41a7-a894-0e0922967d8e')return json({ok:false,error:'WinTurbo Instagram queue item required'},400);
  const {data:grant}=await admin.from('user_publishing_account_access').select('can_approve,can_publish,is_active').eq('user_id',user.id).eq('publishing_account_id',q.publishing_account_id).eq('is_active',true).maybeSingle();
  const {data:profile}=await admin.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(profile?.role!=='admin'&&!(grant?.can_approve&&grant?.can_publish))return json({ok:false,error:'Not authorized to approve and publish this channel'},403);
  const token=Deno.env.get('BUFFER_API_KEY');
  if(!token)return json({ok:false,error:'Buffer server connection is incomplete. Add BUFFER_API_KEY to the Supabase function secrets. This post remains in Approval.'},409);
  if(body.action==='check')return json({ok:true});
  if(!q.media_url)return json({ok:false,error:'Instagram requires an image or video. Add media before publishing.'},400);
  if(q.external_post_id)return json({ok:true,already_submitted:true,post_id:q.external_post_id});
  if(!['approved','draft','pending','pending_approval'].includes(q.status))return json({ok:false,error:'Post is not ready for approval'},409);
  const due=body.action==='schedule'?new Date(body.scheduled_for):null;
  if(due&&(!Number.isFinite(due.getTime())||due.getTime()<=Date.now()))return json({ok:false,error:'Choose a future schedule time'},400);
  const claim=await admin.from('publishing_queue').update({status:'publishing',approved_by:user.id,approved_at:new Date().toISOString()}).eq('id',q.id).eq('status',q.status).is('external_post_id',null).select('id').maybeSingle();
  if(claim.error)throw claim.error;if(!claim.data)return json({ok:false,error:'Another publishing request is already processing'},409);
  const input={text:q.content_text,channelId:'6acca996778b240e2fe4b9a3',schedulingType:'automatic',mode:due?'customScheduled':'shareNow',needsApproval:false,assets:[{[['video','reel'].includes(q.media_type)?'video':'image']:{url:q.media_url}}],...(due?{dueAt:due.toISOString()}:{})};
  let response;
  try{response=await fetch('https://api.buffer.com',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:'mutation Create($input: CreatePostInput!) { createPost(input:$input) { ... on PostActionSuccess { post { id dueAt status sentAt } } ... on MutationError { message } } }',variables:{input}}),signal:AbortSignal.timeout(60000)});}
  catch{await admin.from('publishing_queue').update({error_message:'Buffer response was interrupted; verify delivery before retrying.'}).eq('id',q.id);return json({ok:false,error:'Buffer delivery is unknown. Verify the post before retrying.'},502);}
  const result=await response.json(),post=result.data?.createPost?.post;
  if(!response.ok||!post?.id){await admin.from('publishing_queue').update({status:'approved',error_message:result.data?.createPost?.message||result.errors?.[0]?.message||'Buffer rejected the post'}).eq('id',q.id);return json({ok:false,error:result.data?.createPost?.message||result.errors?.[0]?.message||'Buffer rejected the post'},502);}
  const updated=await admin.from('publishing_queue').update({external_post_id:'buffer:'+post.id,status:post.status==='sent'?'published':due?'scheduled':'publishing',published_at:post.status==='sent'?post.sentAt||new Date().toISOString():null,scheduled_for:due?.toISOString()||null,error_message:null,updated_at:new Date().toISOString()}).eq('id',q.id);
  if(updated.error)throw updated.error;
  return json({ok:true,post_id:post.id,submitted:true,scheduled_for:due?.toISOString()||null});
 }catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},500);}
});
