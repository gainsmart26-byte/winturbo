/* Recover incomplete social slots without creating another plan or publishing. */
(() => {
  const $ = id => document.getElementById(id);
  const busy = new Set();
  async function invoke(name, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150000);
    try {
      const result = await sb.functions.invoke(name, {body, signal: controller.signal});
      if (result.error || result.data?.ok === false) {
        let detail = result.data?.error;
        if (!detail && result.error?.context?.clone) {
          try { detail = (await result.error.context.clone().json()).error; } catch {}
        }
        throw new Error(detail || result.error?.message || 'Generation failed');
      }
      return result.data;
    } finally { clearTimeout(timer); }
  }
  async function recover(id) {
    if (busy.has(id)) return;
    busy.add(id);
    try {
      const row = await sb.from('social_content_calendar').select('*').eq('id',id).single();
      if (row.error) throw row.error;
      const slot = row.data;
      if (slot.queue_id) throw new Error('This post is already in Approval.');
      const accountResult = await sb.from('publishing_accounts').select('id,platform,account_name,username,entity_category').eq('id',slot.publishing_account_id).single();
      if (accountResult.error) throw accountResult.error;
      const account = accountResult.data;
      let evidence = [], theme = slot.topic, prompt = `Original social creative for ${account.account_name}.`;
      if (slot.event_id) {
        const event = await sb.from('winturbo_events').select('*').eq('id',slot.event_id).single();
        if (event.error) throw event.error;
        if (!window.WinTurboEventSelection.current(event.data)) throw new Error('This event is no longer current. Create content from a current event.');
        const brief = window.WinTurboEventSelection.brief(event.data);
        theme = event.data.event_name;
        evidence = [{account_name:'WinTurbo',post_text:brief.facts,source_url:event.data.source_url}];
        prompt += ` ${brief.visual}. ${brief.facts}. ${brief.instruction}`;
      }
      let text = slot.content_text;
      if (!text?.trim()) {
        const generated = await invoke('generate-social-post',{platform:account.platform,publishing_account_id:account.id,brand:{publishing_account_id:account.id},content_format:slot.content_format,recommendation:{theme,media_type:slot.content_format,hook_direction:'Write an original post using only verified supplied facts.',cta_direction:'Brand-appropriate CTA. 18+ and play responsibly.'},evidence});
        text = generated?.text;
        if (!text?.trim()) throw new Error('No caption returned.');
        const save = await sb.from('social_content_calendar').update({content_text:text}).eq('id',id);
        if (save.error) throw save.error;
      }
      let media = slot.media_url;
      if (!media && slot.content_format !== 'text') {
        const video = slot.content_format === 'video';
        const generated = await invoke(video?'generate-fal-video':'generate-openai-image',{publishing_account_id:account.id,prompt:prompt+' '+text,aspect_ratio:video?'9:16':'1:1',duration:10,quality:'medium'});
        media = generated?.image_url || generated?.video_url || generated?.url;
        if (!media) throw new Error('Media service returned no URL. Caption is saved; retry the media step.');
      }
      const updated = await sb.from('social_content_calendar').update({content_text:text,media_url:media,status:'generated'}).eq('id',id);
      if (updated.error) throw updated.error;
      alert('Post generated. Use Send to Approval on its card. Nothing has been published.');
    } catch (error) {
      alert('Could not complete this post: '+(error.message||error)+'. Any completed caption remains saved.');
    } finally {
      busy.delete(id);
      if (window.WinTurboSocialManager) await window.WinTurboSocialManager();
    }
  }
  async function attach() {
    const host = $('smCalendar59'), account = $('smBrand59')?.value;
    if (!host || !account || typeof sb === 'undefined') return;
    const rows = await sb.from('social_content_calendar').select('id,status,content_text,queue_id').eq('publishing_account_id',account).order('content_date').order('scheduled_for');
    if (rows.error || $('smBrand59')?.value !== account) return;
    host.querySelectorAll('.approvalCard').forEach((card,index) => {
      const row = rows.data[index];
      if (!row || row.queue_id || !['planned','generation_failed'].includes(row.status) || card.querySelector('.smRecover')) return;
      const button = document.createElement('button');
      button.type='button'; button.className='mini smRecover';
      button.textContent=row.content_text?'Retry Image / Video':'Retry Generation';
      button.onclick=()=>{button.disabled=true;button.textContent='Generating…';recover(row.id);};
      card.appendChild(button);
    });
  }
  let timer;
  new MutationObserver(records=>{
    if(records.some(r=>r.target.id==='smCalendar59')) {clearTimeout(timer);timer=setTimeout(attach,50);}
  }).observe(document.documentElement,{childList:true,subtree:true});
  window.WinTurboSocialRecovery={invoke,recover,attach};
})();
