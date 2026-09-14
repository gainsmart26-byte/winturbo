from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Remove the brittle chained binding that throws when addSourceInline is absent.
s=s.replace("$('addSourceBtn').onclick=$('addSourceInline').onclick=()=>{$('sourceModal').classList.remove('hide');$('sourceMsg').textContent=''};",
"if($('addSourceBtn'))$('addSourceBtn').onclick=()=>{$('sourceModal')?.classList.remove('hide');if($('sourceMsg'))$('sourceMsg').textContent=''};if($('addSourceInline'))$('addSourceInline').onclick=()=>{$('sourceModal')?.classList.remove('hide');if($('sourceMsg'))$('sourceMsg').textContent=''};")

runtime=r'''
<script>
/* WINTURBO_ADD_SOURCE_FIX_V30_START */
(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function openSourceModal(platform){
    const modal=$('sourceModal');
    if(!modal)return;
    modal.classList.remove('hide');
    if($('sourceMsg'))$('sourceMsg').textContent='';
    if(platform&&$('sourcePlatform'))$('sourcePlatform').value=platform;
    syncPlaceholder();
    setTimeout(()=>$('sourceUrl')?.focus(),30);
  }
  function closeSourceModal(){$('sourceModal')?.classList.add('hide')}
  function syncPlaceholder(){
    const p=$('sourcePlatform')?.value||'Telegram',input=$('sourceUrl');if(!input)return;
    input.placeholder=p==='Telegram'?'https://t.me/channelname':p==='Instagram'?'https://www.instagram.com/account/':p==='Discord'?'https://discord.com/channels/server_id/channel_id':'https://example.com';
  }
  function inferHandle(url,platform){
    try{
      const u=new URL(url);
      if(platform==='Telegram'||u.hostname.includes('t.me')) return u.pathname.replace(/^\/s\//,'').replace(/^\//,'').split('/')[0]||null;
      if(platform==='Instagram'||u.hostname.includes('instagram.com')) return u.pathname.replace(/^\/+|\/+$/g,'').split('/')[0]||null;
      if(platform==='Discord'){
        const m=u.pathname.match(/\/channels\/([^/]+)\/([^/]+)/);return m?m[2]:null;
      }
    }catch{}
    return null;
  }
  async function saveSourceV30(){
    const btn=$('saveSource'),msg=$('sourceMsg');
    const url=$('sourceUrl')?.value.trim()||'',name=$('sourceName')?.value.trim()||'',platform=$('sourcePlatform')?.value||'Telegram',category=$('sourceEntityCategory')?.value||'influencer';
    if(!/^https?:\/\//i.test(url)){if(msg)msg.innerHTML='<span class="error">Enter a valid public http/https URL.</span>';return}
    if(btn){btn.disabled=true;btn.textContent='Adding…'}
    if(msg)msg.textContent='Adding source…';
    try{
      const {data:{user}}=await sb.auth.getUser();
      const handle=inferHandle(url,platform);
      const payload={source_url:url,platform,entity_category:category,source_name:name||handle||url,handle,created_by:user?.id||null,scrape_status:'queued',is_active:true};
      const {data,error}=await sb.from('monitored_sources').insert(payload).select('*').single();
      if(error)throw error;
      if(platform==='Discord'){
        if(msg)msg.textContent='Discord source saved · checking bot access…';
        try{
          const r=await sb.functions.invoke('discord-collector',{body:{action:'ingest_source',source_id:data.id}});
          if(r.error)throw r.error;
          if(!r.data?.ok)throw new Error(r.data?.error||'Bot access required');
          if(msg)msg.textContent=`Discord connected ✓ · ${r.data.messages_ingested||0} messages collected.`;
        }catch(e){if(msg)msg.textContent=`Discord source saved. Bot access is required before messages can be collected: ${e?.message||e}`}
      }else{
        if(msg)msg.textContent='Added ✓ · scheduled collection will backfill up to the last 7 days where available.';
      }
      if($('sourceUrl'))$('sourceUrl').value='';if($('sourceName'))$('sourceName').value='';
      if(typeof loadSources==='function')await loadSources();
      if(typeof renderAll==='function')renderAll();
      if(platform!=='Discord')setTimeout(closeSourceModal,700);
    }catch(e){if(msg)msg.innerHTML=`<span class="error">${esc(e?.message||e)}</span>`}
    finally{if(btn){btn.disabled=false;btn.textContent='Add & Start Monitoring'}}
  }
  function bind(){
    const add=$('addSourceBtn');if(add){add.onclick=null;add.addEventListener('click',()=>openSourceModal())}
    const inline=$('addSourceInline');if(inline){inline.onclick=null;inline.addEventListener('click',()=>openSourceModal())}
    const discord=$('addDiscordSource');if(discord){discord.onclick=null;discord.addEventListener('click',()=>openSourceModal('Discord'))}
    const close=$('closeSource');if(close){close.onclick=null;close.addEventListener('click',closeSourceModal)}
    const platform=$('sourcePlatform');if(platform){platform.addEventListener('change',syncPlaceholder)}
    const save=$('saveSource');if(save){save.onclick=null;save.addEventListener('click',saveSourceV30)}
    const modal=$('sourceModal');if(modal&&!modal.dataset.backdropBound){modal.dataset.backdropBound='1';modal.addEventListener('click',e=>{if(e.target===modal)closeSourceModal()})}
    syncPlaceholder();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,100));else setTimeout(bind,100);
})();
/* WINTURBO_ADD_SOURCE_FIX_V30_END */
</script>
'''

# Replace prior copy if re-run, otherwise append after all existing runtimes so it wins final bindings.
if 'WINTURBO_ADD_SOURCE_FIX_V30_START' in s:
    s=re.sub(r'<script>\s*/\* WINTURBO_ADD_SOURCE_FIX_V30_START \*/.*?/\* WINTURBO_ADD_SOURCE_FIX_V30_END \*/\s*</script>',runtime,s,flags=re.S)
else:
    s=s.replace('</body>',runtime+'\n</body>',1)

p.write_text(s,encoding='utf-8')
print('Add Data Source fixed with guarded modal/open/save bindings for Telegram, Instagram, Discord and Web.')
