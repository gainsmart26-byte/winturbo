/* WinTurbo Instagram uses the dashboard approval queue, never a website redirect. */
(() => {
  const accountId='b1085af0-bafa-41a7-a894-0e0922967d8e';
  const $=id=>document.getElementById(id);
  const sending=new Set();
  async function send(key) {
    if(sending.has(key))return;
    sending.add(key);
    const button=$(key+'InstagramApproval');
    if(button)button.disabled=true;
    try {
      const manual=key==='sendManualApprovalV74', idea=key==='publishIdeaTelegram';
      const text=(manual?$('manualCaptionV74')?.value:idea?$('ideaDraft')?.value||$('readyPostCopy')?.textContent:$('generatedPost')?.value)?.trim();
      if(!text||/^(Generate content|Generating|AI generation is not available)/i.test(text))throw new Error('Create or enter a caption first.');
      const format=manual?$('manualFormatV74')?.value:idea?$('ideaFormat')?.value:'image';
      const file=manual?$('manualMediaFileV74')?.files?.[0]:null;
      let media=manual?$('manualMediaUrlV74')?.value?.trim():idea?$('ideaMediaUrl')?.value?.trim():null;
      const {data:{user}}=await sb.auth.getUser();
      if(!user)throw new Error('Log in before sending to Approval.');
      if(file){
        const path=user.id+'/instagram/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9.\-_]/g,'_');
        const uploaded=await sb.storage.from('generated-media').upload(path,file,{contentType:file.type,upsert:false});
        if(uploaded.error)throw uploaded.error;
        media=sb.storage.from('generated-media').getPublicUrl(path).data.publicUrl;
      }
      const video=['video','reel'].includes(format)||file?.type.startsWith('video/');
      const response=await sb.from('publishing_queue').insert({platform:'instagram',publishing_account_id:accountId,content_text:text,media_url:media||null,media_type:media?(video?'video':'image'):'text',content_format:format||'post',entity_category:'company',status:'draft',created_by:user.id,requested_by:user.id}).select('id').single();
      if(response.error)throw response.error;
      if(!response.data?.id)throw new Error('Approval did not return a saved post.');
      const status=idea?$('ideaPublishStatus'):manual?$('manualStatusV74'):$('postModalSub');
      if(status)status.textContent='Sent to Approval ✓ · WinTurbo Instagram · @winturboplay';
      $('postModal')?.classList.add('hide');
      if(window.WinTurboHydrate)await window.WinTurboHydrate();
      document.querySelector('button[data-s="approval"]')?.click();
    }catch(error){alert('Could not send to Approval: '+(error.message||error));}
    finally{sending.delete(key);if(button)button.disabled=false;}
  }
  function install(){
    const existing=$('publishIdeaInstagram');if(existing&&!existing.dataset.instagramQueueBound){existing.disabled=false;existing.textContent='Send to WinTurbo Instagram Approval';existing.dataset.instagramQueueBound='true';existing.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();send('publishIdeaTelegram');},true);}
    ['publishTelegram','publishIdeaTelegram','sendManualApprovalV74'].forEach(key=>{
      const anchor=$(key);if(!anchor||$(key+'InstagramApproval'))return;
      const button=document.createElement('button');button.type='button';button.id=key+'InstagramApproval';button.className='ghost';
      button.textContent='Send to WinTurbo Instagram Approval';button.onclick=()=>send(key);anchor.after(button);
    });
  }
  window.WinTurboInvokePublisher=async(options={})=>{
    const id=options.body?.queue_id;
    if(!id)return {data:null,error:new Error('Queue item is required')};
    const item=await sb.from('publishing_queue').select('platform').eq('id',id).single();
    if(item.error)return {data:null,error:item.error};
    const instagram=item.data?.platform==='instagram';
    const result=await sb.functions.invoke(instagram?'publish-instagram':'publish-telegram',instagram?{...options,body:{...options.body,action:'now'}}:options);
    if(result.error){
      let detail=result.data?.error;
      try{if(!detail&&result.error.context?.clone)detail=(await result.error.context.clone().json()).error;}catch{}
      return {data:result.data,error:new Error(detail||result.error.message)};
    }
    return result;
  };
  // Route existing publisher and timing controls by the queue item's platform.
  function route(){
    if(typeof sb==='undefined'||sb.functions.__instagramApprovalRoute)return false;
    const original=sb.functions.invoke.bind(sb.functions),rpc=sb.rpc.bind(sb);
    sb.functions.invoke=async(name,options={})=>{
      if(name==='publish-telegram'&&options.body?.queue_id){
        const item=await sb.from('publishing_queue').select('platform').eq('id',options.body.queue_id).single();
        if(item.error)return {data:null,error:item.error};
        if(item.data?.platform==='instagram')return original('publish-instagram',{...options,body:{...options.body,action:'now'}});
      }
      return original(name,options);
    };
    sb.rpc=async(name,args={},options)=>{
      if(['prepare_publishing_item_now','schedule_publishing_item','cancel_scheduled_publishing_item'].includes(name)){
        const item=await sb.from('publishing_queue').select('platform').eq('id',args.p_queue_id).single();
        if(item.error)return {data:null,error:item.error};
        if(item.data?.platform==='instagram'){
          if(name==='cancel_scheduled_publishing_item')return {data:null,error:new Error('This schedule is held by Buffer. Cancel it in Buffer before changing the dashboard record.')};
          // Check configuration before changing the queue to a publishing state.
          const check=await original('publish-instagram',{body:{action:'check',queue_id:args.p_queue_id}});
          if(check.error||!check.data?.ok)return {data:null,error:new Error(check.data?.error||check.error?.message||'Buffer server connection is required.')};
          if(name==='schedule_publishing_item'){const result=await original('publish-instagram',{body:{action:'schedule',queue_id:args.p_queue_id,scheduled_for:args.p_scheduled_for}});return {data:result.data,error:result.error||(!result.data?.ok?new Error(result.data?.error||'Scheduling failed'):null)};}
        }
      }
      return rpc(name,args,options);
    };
    sb.functions.__instagramApprovalRoute=true;return true;
  }
  function boot(){install();if(!route())setTimeout(boot,250);}
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
