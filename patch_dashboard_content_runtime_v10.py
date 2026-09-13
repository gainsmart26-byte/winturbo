from pathlib import Path

p=Path('dashboard.html')
s=p.read_text()

# 1) Repair the Supabase CDN script tag. Prior patches injected inline JS inside a <script src=...>
# block, which browsers ignore. Collapse it back to a normal external script tag.
open_tag='<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">'
start=s.find(open_tag)
if start!=-1:
    end=s.find('</script>', start)
    if end!=-1:
        s=s[:start] + open_tag + '</script>' + s[end+len('</script>'):]

# 2) Remove any previous repaired Content Ideas runtime block so this patch is idempotent.
start_marker='/* WINTURBO_CONTENT_RUNTIME_V10_START */'
end_marker='/* WINTURBO_CONTENT_RUNTIME_V10_END */'
while start_marker in s and end_marker in s:
    a=s.find(start_marker)
    b=s.find(end_marker,a)
    if b<0: break
    s=s[:a]+s[b+len(end_marker):]

runtime=r'''
/* WINTURBO_CONTENT_RUNTIME_V10_START */
async function generateContentIdea(){
  const input=$('ideaInput')?.value.trim();
  if(!input){alert('Enter an idea, topic, keywords, event or site link first.');return;}
  const platform=$('ideaPlatform')?.value||'telegram';
  const type=$('ideaType')?.value||'idea';
  const tone=$('ideaTone')?.value||'Premium & confident';
  const format=$('ideaFormat')?.value||'image';
  const btn=$('generateIdeaContent');
  const old=btn?.textContent||'Generate with ChatGPT';
  if(btn){btn.disabled=true;btn.textContent='Generating…';}
  if($('ideaStatus'))$('ideaStatus').textContent='ChatGPT is creating an original WinTurbo draft…';
  try{
    const recommendation={
      theme:`${type}: ${input}`,
      media_type:format,
      hook_direction:`Create original WinTurbo content around this brief: ${input}`,
      cta_direction:`Tone: ${tone}. End with a clear, appropriate call to action.`,
      confidence:'User-directed'
    };
    const evidence=[{account_name:'User brief',post_text:input}];
    const{data,error}=await sb.functions.invoke('generate-social-post',{body:{platform,recommendation,evidence}});
    if(error)throw new Error(error?.message||'Edge Function request failed');
    if(!data?.ok)throw new Error(data?.error||'Content generation failed');
    if($('ideaDraft'))$('ideaDraft').value=data.text||'';
    buildIdeaMediaPrompt();
    if($('ideaStatus'))$('ideaStatus').textContent=`Generated for ${platform} · ${data.model||'OpenAI'}`;
  }catch(e){
    if($('ideaStatus'))$('ideaStatus').textContent=`Generation failed: ${e?.message||e}`;
    console.error('Content Ideas generation error',e);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=old;}
  }
}

function buildIdeaMediaPrompt(){
  const input=$('ideaInput')?.value.trim()||'';
  const draft=$('ideaDraft')?.value.trim()||'';
  const format=$('ideaFormat')?.value||'image';
  const tone=$('ideaTone')?.value||'Premium & confident';
  const ratio=format==='video'?'9:16 vertical':'1:1 social';
  const prompt=`Create a premium WinTurbo ${format} creative for social media. Brief: ${input}. Messaging context: ${draft.slice(0,650)}. Visual tone: ${tone}. Format: ${ratio}. Indian audience, bold modern Gen-Z gaming aesthetic, premium trustworthy presentation, strong readable hierarchy, no fake receipts, no fabricated claims, avoid clutter. Include WinTurbo branding naturally. For video: cinematic movement, Indian-English-friendly pacing, clear subtitle-safe lower area, 8-10 seconds.`;
  if($('higgsfieldPrompt'))$('higgsfieldPrompt').value=prompt;
  return prompt;
}

function setHiggsfieldPreview(url,type){
  const box=$('higgsfieldPreview'); if(!box)return;
  if(!url){box.innerHTML='';return;}
  const safe=esc(url);
  box.innerHTML=type==='video'
    ? `<video controls playsinline style="width:100%;max-height:420px;border-radius:12px;border:1px solid var(--line)" src="${safe}"></video>`
    : `<img alt="Higgsfield generated creative" style="width:100%;max-height:420px;object-fit:contain;border-radius:12px;border:1px solid var(--line);background:#080b09" src="${safe}">`;
}

function higgsfieldErrorMessage(error,data){
  return data?.error || error?.context?.body?.error || error?.message || 'Higgsfield generation failed';
}

async function generateHiggsfieldImageDirect({silent=false}={}){
  const prompt=$('higgsfieldPrompt')?.value.trim()||buildIdeaMediaPrompt();
  if(!prompt){alert('Build a media prompt first.');return null;}
  const btn=$('generateHiggsfieldImage'), old=btn?.textContent;
  if(btn&&!silent){btn.disabled=true;btn.textContent='Generating…';}
  if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent='Generating image with Higgsfield…';
  try{
    const{data,error}=await sb.functions.invoke('generate-higgsfield-image',{body:{prompt,aspect_ratio:'9:16'}});
    if(error||!data?.ok)throw new Error(higgsfieldErrorMessage(error,data));
    const url=data.image_url||data.images?.[0]?.url;
    if(!url)throw new Error('Higgsfield returned no image URL');
    if($('ideaMediaUrl'))$('ideaMediaUrl').value=url;
    if($('ideaSourceImageUrl'))$('ideaSourceImageUrl').value=url;
    setHiggsfieldPreview(url,'image');
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Image generated ✓ · ${data.endpoint||'Higgsfield'}`;
    return url;
  }catch(e){
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Image generation failed: ${e?.message||e}`;
    if(!silent)alert(`Higgsfield image generation failed: ${e?.message||e}`);
    return null;
  }finally{if(btn&&!silent){btn.disabled=false;btn.textContent=old;}}
}

async function generateHiggsfieldVideoDirect(){
  const prompt=$('higgsfieldPrompt')?.value.trim()||buildIdeaMediaPrompt();
  if(!prompt){alert('Build a media prompt first.');return;}
  const btn=$('generateHiggsfieldVideo'), old=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent='Preparing…';}
  try{
    let source=$('ideaSourceImageUrl')?.value.trim();
    if(!source){
      if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent='No source image supplied — generating one first…';
      source=await generateHiggsfieldImageDirect({silent:true});
      if(!source)throw new Error('Could not create the source image required for video generation');
    }
    if(btn)btn.textContent='Generating video…';
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent='Generating video with Higgsfield…';
    const{data,error}=await sb.functions.invoke('generate-higgsfield-video',{body:{prompt,image_url:source}});
    if(error||!data?.ok)throw new Error(higgsfieldErrorMessage(error,data));
    const url=data.video_url||data.videos?.[0]?.url;
    if(!url)throw new Error('Higgsfield returned no video URL');
    if($('ideaMediaUrl'))$('ideaMediaUrl').value=url;
    setHiggsfieldPreview(url,'video');
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Video generated ✓ · ${data.model||data.endpoint||'Higgsfield'}`;
  }catch(e){
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Video generation failed: ${e?.message||e}`;
    alert(`Higgsfield video generation failed: ${e?.message||e}`);
  }finally{if(btn){btn.disabled=false;btn.textContent=old;}}
}

async function publishIdeaTelegram(){
  const text=$('ideaDraft')?.value.trim();
  if(!text){alert('Generate or enter content first.');return;}
  const account=allPublishingAccounts.find(x=>x.connection_status==='connected')||allPublishingAccounts[0];
  if(!account){alert('Telegram publishing account is not configured.');return;}
  if(account.connection_status!=='connected'){alert('Verify Telegram in the Verification tab before publishing.');return;}
  if(!confirm(`Publish this content now to @${account.username||'winturbonow'}?`))return;
  const btn=$('publishIdeaTelegram'), old=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent='Publishing…';}
  try{
    const{data:{user}}=await sb.auth.getUser();
    const mediaUrl=$('ideaMediaUrl')?.value.trim()||null;
    const fmt=$('ideaFormat')?.value||'text';
    const mediaType=mediaUrl?(fmt==='video'?'video':'photo'):null;
    const payload={platform:'telegram',publishing_account_id:account.id,content_text:text,status:'approved',created_by:user?.id||null};
    if(mediaUrl){payload.media_url=mediaUrl;payload.media_type=mediaType;}
    const{data:q,error:qErr}=await sb.from('publishing_queue').insert(payload).select('id').single();
    if(qErr)throw qErr;
    const{data,error}=await sb.functions.invoke('publish-telegram',{body:{action:'publish',queue_id:q.id}});
    if(error)throw error;
    if(!data?.ok)throw new Error(data?.error||'Telegram publish failed');
    if($('ideaPublishStatus'))$('ideaPublishStatus').innerHTML=`Published ✓${data.published_url?` · <a target="_blank" rel="noopener" href="${esc(data.published_url)}">Open post ↗</a>`:''}`;
  }catch(e){if($('ideaPublishStatus'))$('ideaPublishStatus').textContent=`Publish failed: ${e?.message||e}`;}
  finally{if(btn){btn.disabled=false;btn.textContent=old;}}
}

function bindContentIdeasRuntime(){
  const gen=$('generateIdeaContent'); if(gen)gen.onclick=generateContentIdea;
  const regen=$('regenerateIdeaContent'); if(regen)regen.onclick=generateContentIdea;
  const copy=$('copyIdeaDraft'); if(copy)copy.onclick=async()=>{try{await navigator.clipboard.writeText($('ideaDraft')?.value||'');copy.textContent='Copied ✓';setTimeout(()=>copy.textContent='Copy Draft',1200);}catch{}};
  const build=$('buildMediaPrompt'); if(build)build.onclick=buildIdeaMediaPrompt;
  const img=$('generateHiggsfieldImage'); if(img)img.onclick=()=>generateHiggsfieldImageDirect();
  const vid=$('generateHiggsfieldVideo'); if(vid)vid.onclick=generateHiggsfieldVideoDirect;
  const pub=$('publishIdeaTelegram'); if(pub)pub.onclick=publishIdeaTelegram;
  const media=$('ideaMediaUrl'); if(media)media.addEventListener('change',()=>{const url=media.value.trim();if(url)setHiggsfieldPreview(url,($('ideaFormat')?.value==='video'?'video':'image'));});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindContentIdeasRuntime);
else bindContentIdeasRuntime();
/* WINTURBO_CONTENT_RUNTIME_V10_END */
'''

# Append to the final inline script block, not an external script tag.
idx=s.rfind('</script>')
if idx==-1:
    raise SystemExit('No script closing tag found')
s=s[:idx]+runtime+'\n'+s[idx:]

p.write_text(s)
print('repaired Content Ideas runtime and Supabase script tag')
