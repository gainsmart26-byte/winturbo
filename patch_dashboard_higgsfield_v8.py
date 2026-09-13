from pathlib import Path

p=Path('dashboard.html')
s=p.read_text()

# Verification: mark Higgsfield as server-side API instead of bridge.
s=s.replace('<span class="pill blue">BRIDGE</span></div><div class="subv">The dashboard can prepare/copy prompts and open Higgsfield. Direct inline generation requires a Higgsfield API/SDK credential configured server-side.</div><a class="ghost" style="display:inline-block;margin-top:14px" target="_blank" rel="noopener" href="https://higgsfield.ai/">Open Higgsfield ↗</a>', '<span class="pill">SERVER API</span></div><div class="subv">Higgsfield credentials are stored server-side in Supabase Edge Function secrets. Content Ideas can generate images and videos without exposing the credential to the browser.</div><div class="subv" style="margin-top:8px">Functions: generate-higgsfield-image · generate-higgsfield-video</div>', 1)

# Replace the Higgsfield bridge controls with direct generation controls and preview.
old='''<div class="modalActions" style="justify-content:flex-start"><button id="buildMediaPrompt" class="ghost">Build Media Prompt</button><button id="openHiggsfield" class="primary">Copy Prompt & Open Higgsfield</button></div><div class="k" style="margin-top:12px">Generated Media URL</div><input id="ideaMediaUrl" placeholder="Paste final image/video URL here after generation"><div class="subv">Direct media generation inside WinTurbo can be added once Higgsfield API/SDK access is configured server-side.</div>'''
new='''<div class="modalActions" style="justify-content:flex-start"><button id="buildMediaPrompt" class="ghost">Build Media Prompt</button><button id="generateHiggsfieldImage" class="primary">Generate Image</button><button id="generateHiggsfieldVideo" class="primary">Generate Video</button></div><div id="higgsfieldGenerationStatus" class="subv" style="margin-top:8px">Ready for server-side Higgsfield generation.</div><div class="k" style="margin-top:12px">Video Source Image URL</div><input id="ideaSourceImageUrl" placeholder="Optional. If blank, WinTurbo will generate a source image first."><div class="k" style="margin-top:12px">Generated Media URL</div><input id="ideaMediaUrl" placeholder="Generated Higgsfield media URL will appear here"><div id="higgsfieldPreview" style="margin-top:12px"></div><div class="subv">Generated media is attached automatically when you publish to Telegram.</div>'''
s=s.replace(old,new,1)

js=r'''
function setHiggsfieldPreview(url,type){
  const box=$('higgsfieldPreview'); if(!box)return;
  if(!url){box.innerHTML='';return}
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
  if(!prompt){alert('Build a media prompt first.');return null}
  const btn=$('generateHiggsfieldImage'), old=btn?.textContent;
  if(btn&&!silent){btn.disabled=true;btn.textContent='Generating…'}
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
  }finally{if(btn&&!silent){btn.disabled=false;btn.textContent=old}}
}
async function generateHiggsfieldVideoDirect(){
  const prompt=$('higgsfieldPrompt')?.value.trim()||buildIdeaMediaPrompt();
  if(!prompt){alert('Build a media prompt first.');return}
  const btn=$('generateHiggsfieldVideo'), old=btn?.textContent; if(btn){btn.disabled=true;btn.textContent='Preparing…'}
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
  }finally{if(btn){btn.disabled=false;btn.textContent=old}}
}
if($('generateHiggsfieldImage'))$('generateHiggsfieldImage').onclick=()=>generateHiggsfieldImageDirect();
if($('generateHiggsfieldVideo'))$('generateHiggsfieldVideo').onclick=generateHiggsfieldVideoDirect;
if($('ideaMediaUrl'))$('ideaMediaUrl').addEventListener('change',()=>{const url=$('ideaMediaUrl').value.trim();if(url)setHiggsfieldPreview(url,($('ideaFormat')?.value==='video'?'video':'image'))});
'''

# Disable the old website-opening handler if it exists and insert direct-generation JS.
s=s.replace("if($('openHiggsfield'))$('openHiggsfield').onclick=openIdeaHiggsfield;", "if($('openHiggsfield'))$('openHiggsfield').onclick=openIdeaHiggsfield;\n"+js, 1)

p.write_text(s)
print('dashboard direct Higgsfield generation v8 patched')
