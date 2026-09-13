from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text()

# Replace the Content Ideas section with the streamlined auto-generation workflow.
start=s.find('<section id="contentIdeas" class="section">')
if start==-1:
    raise SystemExit('contentIdeas section not found')
end=s.find('</section>', start)
if end==-1:
    raise SystemExit('contentIdeas section end not found')
end += len('</section>')

section=r'''
<section id="contentIdeas" class="section">
  <div class="sectionHead"><div><h2 style="margin:0">Content Ideas</h2><div class="muted small">Create copy and the selected creative automatically, then review everything together before posting.</div></div><span class="pill">AI WORKSPACE</span></div>

  <div class="grid2">
    <div class="card">
      <h3>1. Build the idea</h3>
      <div class="grid2">
        <div><div class="k">Content Type</div><select id="ideaType"><option value="idea">Idea</option><option value="topic">Topic</option><option value="keywords">Keywords</option><option value="event">Event</option><option value="link">Site Link</option></select></div>
        <div><div class="k">Primary Platform</div><select id="ideaPlatform"><option value="telegram">Telegram</option><option value="instagram">Instagram</option></select></div>
      </div>
      <div class="k" style="margin-top:12px">Idea / Topic / Keywords / Event / Link</div>
      <textarea id="ideaInput" style="min-height:110px" placeholder="Example: IPL weekend match, fastest withdrawal experience, 24×7 support, first-deposit offer, or paste a website link"></textarea>
      <div class="grid2">
        <div><div class="k">Tone</div><select id="ideaTone"><option>Premium & confident</option><option>Gen Z & energetic</option><option>Trust-led</option><option>Short & urgent</option><option>Informative</option></select></div>
        <div><div class="k">Creative Format</div><select id="ideaFormat"><option value="image">Image Post</option><option value="video">Short Video / Reel</option><option value="text">Text Only</option></select></div>
      </div>
      <button id="generateIdeaContent" class="primary" style="width:100%;margin-top:12px">Generate with ChatGPT + Creative</button>
      <div id="ideaStatus" class="subv" style="margin-top:8px">The selected creative format will be generated automatically after the copy.</div>
    </div>

    <div class="card">
      <h3>2. AI Draft</h3>
      <textarea id="ideaDraft" style="min-height:240px" placeholder="Generated content will appear here. You can edit it before publishing."></textarea>
      <div class="modalActions" style="justify-content:flex-start"><button id="copyIdeaDraft" class="ghost">Copy Draft</button><button id="regenerateIdeaContent" class="ghost">Regenerate All</button></div>
      <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px">
        <div class="sectionHead"><div><h3 style="margin:0">Generated Creative</h3><div id="higgsfieldGenerationStatus" class="subv">Waiting for generation.</div></div><span id="creativeFormatBadge" class="pill blue">IMAGE</span></div>
        <div id="higgsfieldPreview" style="margin-top:10px"></div>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:14px">
    <div class="sectionHead"><div><h3 style="margin:0">3. Ready to Post</h3><div class="muted small">Final copy and generated media shown together for approval.</div></div><span class="pill">READY WORKSPACE</span></div>
    <div class="grid2">
      <div>
        <div class="k">Post Content</div>
        <div id="readyPostCopy" style="white-space:pre-wrap;min-height:180px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#0b100d" class="small muted">Generate content to preview the final post.</div>
      </div>
      <div>
        <div class="k">Creative</div>
        <div id="readyPostMedia" style="min-height:180px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#0b100d;display:grid;place-items:center" class="small muted">Generated image or video will appear here.</div>
      </div>
    </div>
    <input id="ideaMediaUrl" type="hidden">
    <input id="ideaSourceImageUrl" type="hidden">
    <textarea id="higgsfieldPrompt" class="hide"></textarea>
    <div class="modalActions" style="justify-content:flex-start;margin-top:14px">
      <button id="publishIdeaTelegram" class="primary">Post to Telegram</button>
      <button id="publishIdeaInstagram" class="ghost" disabled>Post to Instagram · Connect Meta First</button>
      <button id="regenerateCreativeOnly" class="ghost">Regenerate Creative</button>
    </div>
    <div id="ideaPublishStatus" class="subv" style="margin-top:8px">Nothing is posted until you approve it.</div>
  </div>
</section>
'''

s=s[:start]+section+s[end:]

# Remove v10 runtime; v11 fully replaces it.
for sm, em in [
    ('/* WINTURBO_CONTENT_RUNTIME_V10_START */','/* WINTURBO_CONTENT_RUNTIME_V10_END */'),
    ('/* WINTURBO_CONTENT_RUNTIME_V11_START */','/* WINTURBO_CONTENT_RUNTIME_V11_END */')
]:
    while sm in s and em in s:
        a=s.find(sm); b=s.find(em,a)
        if b<0: break
        s=s[:a]+s[b+len(em):]

runtime=r'''
/* WINTURBO_CONTENT_RUNTIME_V11_START */
function contentCreativeFormat(){return $('ideaFormat')?.value||'image';}
function updateCreativeBadge(){const f=contentCreativeFormat();const b=$('creativeFormatBadge');if(b)b.textContent=f.toUpperCase();}
function buildIdeaMediaPrompt(){
  const input=$('ideaInput')?.value.trim()||'';
  const draft=$('ideaDraft')?.value.trim()||'';
  const format=contentCreativeFormat();
  const tone=$('ideaTone')?.value||'Premium & confident';
  const ratio=format==='video'?'9:16 vertical':'1:1 social';
  const prompt=`Create a premium WinTurbo ${format} creative for social media. Brief: ${input}. Messaging context: ${draft.slice(0,700)}. Visual tone: ${tone}. Format: ${ratio}. Indian audience, bold modern Gen-Z gaming aesthetic, premium trustworthy presentation, strong readable hierarchy, no fake receipts or fabricated claims, avoid clutter. Include WinTurbo branding naturally. ${format==='video'?'Cinematic movement, Indian-English-friendly pacing, subtitle-safe lower area, approximately 8-10 seconds.':''}`;
  if($('higgsfieldPrompt'))$('higgsfieldPrompt').value=prompt;
  return prompt;
}
function renderReadyPost(){
  const text=$('ideaDraft')?.value.trim()||'';
  const url=$('ideaMediaUrl')?.value.trim()||'';
  const format=contentCreativeFormat();
  const copy=$('readyPostCopy'); if(copy){copy.textContent=text||'Generate content to preview the final post.';copy.classList.toggle('muted',!text);}
  const media=$('readyPostMedia'); if(media){
    if(!url||format==='text') media.innerHTML='<span class="muted small">No media attached.</span>';
    else if(format==='video') media.innerHTML=`<video controls playsinline style="width:100%;max-height:420px;border-radius:12px" src="${esc(url)}"></video>`;
    else media.innerHTML=`<img alt="Ready-to-post creative" style="width:100%;max-height:420px;object-fit:contain;border-radius:12px" src="${esc(url)}">`;
  }
}
function setHiggsfieldPreview(url,type){
  const box=$('higgsfieldPreview'); if(!box)return;
  if(!url){box.innerHTML='';renderReadyPost();return;}
  const safe=esc(url);
  box.innerHTML=type==='video'?`<video controls playsinline style="width:100%;max-height:420px;border-radius:12px;border:1px solid var(--line)" src="${safe}"></video>`:`<img alt="Generated creative" style="width:100%;max-height:420px;object-fit:contain;border-radius:12px;border:1px solid var(--line);background:#080b09" src="${safe}">`;
  renderReadyPost();
}
function hfError(error,data){return data?.error||error?.context?.body?.error||error?.message||'Higgsfield generation failed';}
async function generateSelectedCreative(){
  const format=contentCreativeFormat(); updateCreativeBadge();
  if(format==='text'){
    if($('ideaMediaUrl'))$('ideaMediaUrl').value='';
    if($('higgsfieldPreview'))$('higgsfieldPreview').innerHTML='<div class="muted small">Text-only format selected.</div>';
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent='Text-only format selected · no media generation needed.';
    renderReadyPost(); return true;
  }
  const prompt=buildIdeaMediaPrompt();
  if(!prompt)return false;
  if(format==='image'){
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent='Generating image with Higgsfield…';
    const{data,error}=await sb.functions.invoke('generate-higgsfield-image',{body:{prompt,aspect_ratio:'9:16'}});
    if(error||!data?.ok)throw new Error(hfError(error,data));
    const url=data.image_url||data.images?.[0]?.url; if(!url)throw new Error('Higgsfield returned no image URL');
    $('ideaMediaUrl').value=url; $('ideaSourceImageUrl').value=url; setHiggsfieldPreview(url,'image');
    $('higgsfieldGenerationStatus').textContent='Image generated ✓'; return true;
  }
  if(format==='video'){
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent='Creating source image for video…';
    const img=await sb.functions.invoke('generate-higgsfield-image',{body:{prompt,aspect_ratio:'9:16'}});
    if(img.error||!img.data?.ok)throw new Error(hfError(img.error,img.data));
    const source=img.data.image_url||img.data.images?.[0]?.url; if(!source)throw new Error('Higgsfield returned no source image');
    $('ideaSourceImageUrl').value=source;
    $('higgsfieldGenerationStatus').textContent='Generating video with Higgsfield…';
    const vid=await sb.functions.invoke('generate-higgsfield-video',{body:{prompt,image_url:source}});
    if(vid.error||!vid.data?.ok)throw new Error(hfError(vid.error,vid.data));
    const url=vid.data.video_url||vid.data.videos?.[0]?.url; if(!url)throw new Error('Higgsfield returned no video URL');
    $('ideaMediaUrl').value=url; setHiggsfieldPreview(url,'video');
    $('higgsfieldGenerationStatus').textContent='Video generated ✓'; return true;
  }
}
async function generateContentIdea(){
  const input=$('ideaInput')?.value.trim(); if(!input){alert('Enter an idea, topic, keywords, event or site link first.');return;}
  const platform=$('ideaPlatform')?.value||'telegram'; const type=$('ideaType')?.value||'idea'; const tone=$('ideaTone')?.value||'Premium & confident'; const format=contentCreativeFormat();
  const btn=$('generateIdeaContent'); const old=btn?.textContent||'Generate with ChatGPT + Creative'; if(btn){btn.disabled=true;btn.textContent='Generating copy…';}
  if($('ideaStatus'))$('ideaStatus').textContent='ChatGPT is creating the post copy…';
  try{
    const recommendation={theme:`${type}: ${input}`,media_type:format,hook_direction:`Create original WinTurbo content around this brief: ${input}`,cta_direction:`Tone: ${tone}. End with a clear, appropriate call to action.`,confidence:'User-directed'};
    const evidence=[{account_name:'User brief',post_text:input}];
    const{data,error}=await sb.functions.invoke('generate-social-post',{body:{platform,recommendation,evidence}});
    if(error)throw new Error(error?.message||'Content generation request failed'); if(!data?.ok)throw new Error(data?.error||'Content generation failed');
    $('ideaDraft').value=data.text||''; renderReadyPost();
    if(btn)btn.textContent=format==='text'?'Finishing…':`Generating ${format}…`;
    if($('ideaStatus'))$('ideaStatus').textContent=`Copy generated ✓ · creating ${format==='text'?'final post':format}…`;
    await generateSelectedCreative();
    renderReadyPost();
    if($('ideaStatus'))$('ideaStatus').textContent=`Ready to post ✓ · ${platform} · ${format}`;
  }catch(e){if($('ideaStatus'))$('ideaStatus').textContent=`Generation failed: ${e?.message||e}`;console.error(e);}
  finally{if(btn){btn.disabled=false;btn.textContent=old;}}
}
async function regenerateCreativeOnly(){
  const btn=$('regenerateCreativeOnly'); const old=btn?.textContent; if(btn){btn.disabled=true;btn.textContent='Regenerating…';}
  try{await generateSelectedCreative();renderReadyPost();}
  catch(e){if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Creative generation failed: ${e?.message||e}`;}
  finally{if(btn){btn.disabled=false;btn.textContent=old;}}
}
async function publishIdeaTelegram(){
  const text=$('ideaDraft')?.value.trim(); if(!text){alert('Generate content first.');return;}
  const account=allPublishingAccounts.find(x=>x.connection_status==='connected')||allPublishingAccounts[0]; if(!account){alert('Telegram publishing account is not configured.');return;} if(account.connection_status!=='connected'){alert('Verify Telegram in the Verification tab before publishing.');return;}
  if(!confirm(`Publish this ready-to-post content now to @${account.username||'winturbonow'}?`))return;
  const btn=$('publishIdeaTelegram'),old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Publishing…';}
  try{
    const{data:{user}}=await sb.auth.getUser(); const mediaUrl=$('ideaMediaUrl')?.value.trim()||null; const fmt=contentCreativeFormat();
    const payload={platform:'telegram',publishing_account_id:account.id,content_text:text,status:'approved',created_by:user?.id||null};
    if(mediaUrl&&fmt!=='text'){payload.media_url=mediaUrl;payload.media_type=fmt==='video'?'video':'photo';}
    const{data:q,error:qErr}=await sb.from('publishing_queue').insert(payload).select('id').single(); if(qErr)throw qErr;
    const{data,error}=await sb.functions.invoke('publish-telegram',{body:{action:'publish',queue_id:q.id}}); if(error)throw error;if(!data?.ok)throw new Error(data?.error||'Telegram publish failed');
    $('ideaPublishStatus').innerHTML=`Published ✓${data.published_url?` · <a target="_blank" rel="noopener" href="${esc(data.published_url)}">Open post ↗</a>`:''}`;
  }catch(e){$('ideaPublishStatus').textContent=`Publish failed: ${e?.message||e}`;} finally{if(btn){btn.disabled=false;btn.textContent=old;}}
}
function bindContentIdeasV11(){
  $('generateIdeaContent')&&($('generateIdeaContent').onclick=generateContentIdea);
  $('regenerateIdeaContent')&&($('regenerateIdeaContent').onclick=generateContentIdea);
  $('regenerateCreativeOnly')&&($('regenerateCreativeOnly').onclick=regenerateCreativeOnly);
  $('publishIdeaTelegram')&&($('publishIdeaTelegram').onclick=publishIdeaTelegram);
  if($('copyIdeaDraft'))$('copyIdeaDraft').onclick=async()=>{try{await navigator.clipboard.writeText($('ideaDraft')?.value||'');$('copyIdeaDraft').textContent='Copied ✓';setTimeout(()=>$('copyIdeaDraft').textContent='Copy Draft',1200);}catch{}};
  if($('ideaDraft'))$('ideaDraft').addEventListener('input',renderReadyPost);
  if($('ideaFormat'))$('ideaFormat').addEventListener('change',()=>{updateCreativeBadge();$('ideaMediaUrl').value='';$('ideaSourceImageUrl').value='';if($('higgsfieldPreview'))$('higgsfieldPreview').innerHTML='';renderReadyPost();});
  updateCreativeBadge(); renderReadyPost();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindContentIdeasV11);else bindContentIdeasV11();
/* WINTURBO_CONTENT_RUNTIME_V11_END */
'''
idx=s.rfind('</script>')
if idx==-1: raise SystemExit('No script closing tag found')
s=s[:idx]+runtime+'\n'+s[idx:]
p.write_text(s)
print('Content Ideas automated generation + Ready to Post v11 applied')
