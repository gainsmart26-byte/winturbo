/* WINTURBO_ASYNC_VIDEO_RUNTIME_V1 */
(()=>{
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const text=id=>document.getElementById(id)?.value?.trim()||document.getElementById(id)?.textContent?.trim()||'';
 const setStatus=value=>{for(const id of ['ideaStatus','socialContentStatus','adStatus']){const el=document.getElementById(id);if(el)el.textContent=value}};
 const selectedAccount=()=>['ideaPublishingAccountV49','contentPublishingAccount','recommendationPublishingAccount','socialPublishingAccount'].map(id=>document.getElementById(id)?.value).find(Boolean)||document.querySelector('select[data-channel-target]')?.value||null;
 const selectedCopy=()=>text('ideaDraft')||text('readyPostCopy')||text('manualContentText')||text('socialContentDraft');
 const queuedUrls=new Set();

 async function sendToApproval(videoUrl){
  if(!videoUrl||queuedUrls.has(videoUrl))return;
  const accountId=selectedAccount(),content=selectedCopy();
  if(!accountId||!content)return;
  const account=await sb.from('publishing_accounts').select('id,platform').eq('id',accountId).eq('is_active',true).maybeSingle();
  if(account.error)throw account.error;
  if(!account.data)return;
  const user=(await sb.auth.getUser()).data?.user;
  if(!user)throw new Error('Sign in required');
  const inserted=await sb.from('publishing_queue').insert({platform:account.data.platform,publishing_account_id:account.data.id,content_text:content,media_url:videoUrl,media_type:'video',status:'draft',created_by:user.id,requested_by:user.id}).select('id').single();
  if(inserted.error)throw inserted.error;
  queuedUrls.add(videoUrl);
  setStatus('10-second video ready and sent to Approval ✓');
 }

 function lockDuration(){
  const input=document.getElementById('ideaVideoDuration'),wrap=document.getElementById('ideaVideoDurationWrap');
  if(input){input.value='10';input.min='10';input.max='10';input.type='hidden'}
  if(wrap){const note=wrap.querySelector('.subv');if(note)note.textContent='Fixed at 10 seconds.'}
 }

 function install(){
  lockDuration();
  if(typeof sb==='undefined'||!sb.functions?.invoke||sb.functions.invoke.__winturboAsyncVideo)return false;
  const original=sb.functions.invoke.bind(sb.functions);
  const wrapped=async(name,options={})=>{
   const body=options?.body||{};
   if(name!=='generate-fal-video'||body.action)return original(name,options);
   setStatus('Submitting 10-second video…');
   const submitted=await original(name,{...options,body:{...body,action:'submit',duration:10}});
   if(submitted.error||!submitted.data?.ok)return submitted;
   const requestId=submitted.data.request_id;
   if(!requestId)return {data:{ok:false,error:'Video provider returned no request ID'},error:null};
   const started=Date.now();
   while(Date.now()-started<12*60*1000){
    await sleep(5000);
    const checked=await original(name,{body:{action:'status',request_id:requestId}});
    if(checked.error||!checked.data?.ok)return checked;
    const state=String(checked.data.status||'IN_QUEUE').toUpperCase();
    if(state==='COMPLETED'){
     const url=checked.data.video_url;
     if(url)await sendToApproval(url);
     return checked;
    }
    setStatus(state==='IN_QUEUE'?'Video queued with provider…':'Generating 10-second video…');
   }
   return {data:{ok:false,error:'Video generation is still processing after 12 minutes. Please try again.'},error:null};
  };
  wrapped.__winturboAsyncVideo=true;
  sb.functions.invoke=wrapped;
  return true;
 }

 if(!install()){
  let attempts=0;
  const timer=setInterval(()=>{if(install()||++attempts>40)clearInterval(timer)},250);
 }
 document.addEventListener('change',event=>{if(event.target?.id==='ideaVideoDuration')lockDuration()});
})();
