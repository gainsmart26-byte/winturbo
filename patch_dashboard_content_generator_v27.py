from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Add distinct creative formats and an engine selector.
s=s.replace('<select id="ideaFormat"><option value="image">Image Post</option><option value="video">Short Video / Reel</option><option value="text">Text Only</option></select>',
'''<select id="ideaFormat"><option value="text">Text Only</option><option value="image">Image Post</option><option value="reel">Reel</option><option value="video">Short Video</option></select>''')

anchor='<button id="generateIdeaContent" class="primary" style="width:100%;margin-top:12px">Generate with ChatGPT + Creative</button>'
if anchor in s and 'id="ideaEngine"' not in s:
    s=s.replace(anchor,'''<div id="ideaEngineWrap" style="margin-top:12px"><div class="k">Creative Engine</div><select id="ideaEngine"><option value="higgsfield">Higgsfield</option><option value="openai">OpenAI Image</option></select></div>\n      <button id="generateIdeaContent" class="primary" style="width:100%;margin-top:12px">Generate with ChatGPT</button>''',1)

runtime=r'''
<script>
/* WINTURBO_CONTENT_GENERATOR_V27_START */
(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmt=()=> $('ideaFormat')?.value||'text';
  const engine=()=> $('ideaEngine')?.value||'higgsfield';
  const isVisual=()=>fmt()!=='text';
  function syncUi(){
    const f=fmt(),visual=isVisual();
    const wrap=$('ideaEngineWrap');if(wrap)wrap.style.display=visual?'block':'none';
    const btn=$('generateIdeaContent');if(btn)btn.textContent=visual?'Generate with ChatGPT + Creative':'Generate with ChatGPT';
    const regen=$('regenerateCreativeOnly');if(regen)regen.style.display=visual?'inline-flex':'none';
    const badge=$('creativeFormatBadge');if(badge)badge.textContent=(f==='reel'?'REEL':f==='video'?'SHORT VIDEO':f.toUpperCase());
    if(!visual){
      if($('ideaMediaUrl'))$('ideaMediaUrl').value='';
      if($('higgsfieldPreview'))$('higgsfieldPreview').innerHTML='<div class="muted small">Text-only format selected. No image or video will be generated.</div>';
      if($('readyPostMedia'))$('readyPostMedia').innerHTML='<span class="muted small">Text-only post · no media required.</span>';
      if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent='Text-only format selected · ChatGPT content only.';
      if($('ideaStatus'))$('ideaStatus').textContent='Text-only will generate ChatGPT content only.';
    } else if($('ideaStatus')){
      $('ideaStatus').textContent='ChatGPT will create the copy, then the selected creative engine will create the visual.';
    }
  }
  function mediaPrompt(){
    const input=$('ideaInput')?.value.trim()||'',draft=$('ideaDraft')?.value.trim()||'',tone=$('ideaTone')?.value||'Premium & confident',f=fmt();
    const motion=f==='reel'||f==='video';
    return `Create a premium WinTurbo ${f} creative for social media. Brief: ${input}. Copy context: ${draft.slice(0,700)}. Tone: ${tone}. Indian audience, bold modern Gen-Z gaming aesthetic, premium trustworthy presentation, strong readable hierarchy, no fake receipts or fabricated claims, avoid clutter. Include WinTurbo branding naturally. ${motion?'Vertical 9:16, cinematic motion, subtitle-safe lower area, approximately 8-10 seconds.':'Social image composition.'}`;
  }
  async function createVisual(){
    const f=fmt();if(f==='text')return null;
    const prompt=mediaPrompt();if($('higgsfieldPrompt'))$('higgsfieldPrompt').value=prompt;
    const chosen=engine();
    if(f==='image'){
      if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Generating image with ${chosen==='openai'?'OpenAI Image':'Higgsfield'}…`;
      const fn=chosen==='openai'?'generate-openai-image':'generate-higgsfield-image';
      const {data,error}=await sb.functions.invoke(fn,{body:{prompt,aspect_ratio:'1:1'}});
      if(error||!data?.ok)throw new Error(data?.error||error?.message||'Image generation failed');
      const u=data.image_url||data.images?.[0]?.url||data.url;if(!u)throw new Error('Image engine returned no image URL');
      if($('ideaMediaUrl'))$('ideaMediaUrl').value=u;if($('ideaSourceImageUrl'))$('ideaSourceImageUrl').value=u;
      if($('higgsfieldPreview'))$('higgsfieldPreview').innerHTML=`<img alt="Generated creative" style="width:100%;max-height:420px;object-fit:contain;border-radius:12px;border:1px solid var(--line)" src="${esc(u)}">`;
      if($('readyPostMedia'))$('readyPostMedia').innerHTML=`<img alt="Ready creative" style="width:100%;max-height:420px;object-fit:contain;border-radius:12px" src="${esc(u)}">`;
      if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Image generated with ${chosen==='openai'?'OpenAI Image':'Higgsfield'} ✓`;
      return u;
    }
    // Reel / Short Video: use chosen image engine for source frame, Higgsfield for motion.
    const imageFn=chosen==='openai'?'generate-openai-image':'generate-higgsfield-image';
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Creating source frame with ${chosen==='openai'?'OpenAI Image':'Higgsfield'}…`;
    const img=await sb.functions.invoke(imageFn,{body:{prompt,aspect_ratio:'9:16'}});
    if(img.error||!img.data?.ok)throw new Error(img.data?.error||img.error?.message||'Source image generation failed');
    const source=img.data.image_url||img.data.images?.[0]?.url||img.data.url;if(!source)throw new Error('Image engine returned no source image');
    if($('ideaSourceImageUrl'))$('ideaSourceImageUrl').value=source;
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Generating ${f==='reel'?'reel':'short video'} with Higgsfield…`;
    const vid=await sb.functions.invoke('generate-higgsfield-video',{body:{prompt,image_url:source}});
    if(vid.error||!vid.data?.ok)throw new Error(vid.data?.error||vid.error?.message||'Video generation failed');
    const u=vid.data.video_url||vid.data.videos?.[0]?.url||vid.data.url;if(!u)throw new Error('Higgsfield returned no video URL');
    if($('ideaMediaUrl'))$('ideaMediaUrl').value=u;
    if($('higgsfieldPreview'))$('higgsfieldPreview').innerHTML=`<video controls playsinline style="width:100%;max-height:420px;border-radius:12px;border:1px solid var(--line)" src="${esc(u)}"></video>`;
    if($('readyPostMedia'))$('readyPostMedia').innerHTML=`<video controls playsinline style="width:100%;max-height:420px;border-radius:12px" src="${esc(u)}"></video>`;
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`${f==='reel'?'Reel':'Short video'} generated ✓`;
    return u;
  }
  async function generateV27(){
    const input=$('ideaInput')?.value.trim();if(!input){alert('Enter an idea, topic, keywords, event or site link first.');return;}
    const platform=$('ideaPlatform')?.value||'telegram',type=$('ideaType')?.value||'idea',tone=$('ideaTone')?.value||'Premium & confident',f=fmt();
    const btn=$('generateIdeaContent');if(btn){btn.disabled=true;btn.textContent='Generating with ChatGPT…';}
    if($('ideaStatus'))$('ideaStatus').textContent='ChatGPT is creating the content…';
    try{
      const recommendation={theme:`${type}: ${input}`,media_type:f,hook_direction:`Create original WinTurbo content around this brief: ${input}`,cta_direction:`Tone: ${tone}. End with a clear, appropriate call to action.`,confidence:'User-directed'};
      const evidence=[{account_name:'User brief',post_text:input}];
      const {data,error}=await sb.functions.invoke('generate-social-post',{body:{platform,recommendation,evidence}});
      if(error)throw new Error(error?.message||'ChatGPT content request failed');if(!data?.ok)throw new Error(data?.error||'ChatGPT content generation failed');
      if($('ideaDraft'))$('ideaDraft').value=data.text||'';
      if($('readyPostCopy')){$('readyPostCopy').textContent=data.text||'';$('readyPostCopy').classList.remove('muted');}
      if(f==='text'){
        if($('ideaMediaUrl'))$('ideaMediaUrl').value='';
        if($('ideaStatus'))$('ideaStatus').textContent=`ChatGPT content ready ✓ · ${platform} · text only`;
        if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent='No creative requested.';
      }else{
        if(btn)btn.textContent='Generating creative…';
        if($('ideaStatus'))$('ideaStatus').textContent='ChatGPT content ready ✓ · creating visual…';
        await createVisual();
        if($('ideaStatus'))$('ideaStatus').textContent=`Content + ${f==='reel'?'reel':f==='video'?'short video':'image'} ready ✓`;
      }
    }catch(e){console.error(e);if($('ideaStatus'))$('ideaStatus').textContent=`Generation failed: ${e?.message||e}`;}
    finally{if(btn){btn.disabled=false;syncUi();}}
  }
  async function regenerateVisualV27(){
    if(fmt()==='text'){syncUi();return;}
    const b=$('regenerateCreativeOnly');const old=b?.textContent;if(b){b.disabled=true;b.textContent='Regenerating…';}
    try{await createVisual();}catch(e){if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Creative generation failed: ${e?.message||e}`;}finally{if(b){b.disabled=false;b.textContent=old||'Regenerate Creative';}}
  }
  function bind(){
    syncUi();
    if($('ideaFormat'))$('ideaFormat').onchange=syncUi;
    if($('ideaEngine'))$('ideaEngine').onchange=syncUi;
    if($('generateIdeaContent'))$('generateIdeaContent').onclick=generateV27;
    if($('regenerateIdeaContent'))$('regenerateIdeaContent').onclick=generateV27;
    if($('regenerateCreativeOnly'))$('regenerateCreativeOnly').onclick=regenerateVisualV27;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,50));else setTimeout(bind,50);
})();
/* WINTURBO_CONTENT_GENERATOR_V27_END */
</script>
'''

if 'WINTURBO_CONTENT_GENERATOR_V27_START' in s:
    s=re.sub(r'<script>\s*/\* WINTURBO_CONTENT_GENERATOR_V27_START \*/.*?/\* WINTURBO_CONTENT_GENERATOR_V27_END \*/\s*</script>',runtime,s,flags=re.S)
else:
    s=s.replace('</body>',runtime+'\n</body>',1)

p.write_text(s,encoding='utf-8')
print('Content Ideas generator fixed: text-only ChatGPT; image/reel/video with selectable creative engine.')
