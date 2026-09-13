from pathlib import Path

p=Path('dashboard.html')
s=p.read_text()

# Add image-engine selector beneath Creative Format.
needle='''<div><div class="k">Creative Format</div><select id="ideaFormat"><option value="image">Image Post</option><option value="video">Short Video / Reel</option><option value="text">Text Only</option></select></div>'''
replacement=needle+'''\n      </div>\n      <div style="margin-top:12px"><div class="k">Image Engine</div><select id="imageEngine"><option value="openai">ChatGPT / OpenAI Image</option><option value="higgsfield">Higgsfield Image</option></select><div id="imageEngineHelp" class="subv">Used for Image Post generation and as the source image for Video / Reel generation.</div>'''
# v11 already closes grid immediately after needle; avoid doubling by replacing the following closing div too.
combo=needle+'\n      </div>'
if combo in s:
    s=s.replace(combo,replacement,1)
elif needle in s and 'id="imageEngine"' not in s:
    s=s.replace(needle,needle+'\n      <div style="margin-top:12px"><div class="k">Image Engine</div><select id="imageEngine"><option value="openai">ChatGPT / OpenAI Image</option><option value="higgsfield">Higgsfield Image</option></select><div id="imageEngineHelp" class="subv">Used for Image Post generation and as the source image for Video / Reel generation.</div></div>',1)

# Add provider helper after format helper.
old="function contentCreativeFormat(){return $('ideaFormat')?.value||'image';}"
new=old+"\nfunction selectedImageEngine(){return $('imageEngine')?.value||'openai';}"
s=s.replace(old,new,1)

# Replace image-only branch to use selected engine.
old_image='''  if(format==='image'){
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent='Generating image with Higgsfield…';
    const{data,error}=await sb.functions.invoke('generate-higgsfield-image',{body:{prompt,aspect_ratio:'9:16'}});
    if(error||!data?.ok)throw new Error(hfError(error,data));
    const url=data.image_url||data.images?.[0]?.url; if(!url)throw new Error('Higgsfield returned no image URL');
    $('ideaMediaUrl').value=url; $('ideaSourceImageUrl').value=url; setHiggsfieldPreview(url,'image');
    $('higgsfieldGenerationStatus').textContent='Image generated ✓'; return true;
  }'''
new_image='''  if(format==='image'){
    const engine=selectedImageEngine();
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Generating image with ${engine==='openai'?'ChatGPT / OpenAI':'Higgsfield'}…`;
    const fn=engine==='openai'?'generate-openai-image':'generate-higgsfield-image';
    const body=engine==='openai'?{prompt,aspect_ratio:'1:1',quality:'medium'}:{prompt,aspect_ratio:'1:1'};
    const{data,error}=await sb.functions.invoke(fn,{body});
    if(error||!data?.ok)throw new Error(engine==='openai'?(data?.error||error?.message||'OpenAI image generation failed'):hfError(error,data));
    const url=data.image_url||data.images?.[0]?.url; if(!url)throw new Error(`${engine==='openai'?'OpenAI':'Higgsfield'} returned no image URL`);
    $('ideaMediaUrl').value=url; $('ideaSourceImageUrl').value=url; setHiggsfieldPreview(url,'image');
    $('higgsfieldGenerationStatus').textContent=`Image generated ✓ · ${engine==='openai'?'ChatGPT / OpenAI':'Higgsfield'}`; return true;
  }'''
if old_image in s:
    s=s.replace(old_image,new_image,1)

# Replace video source-image generation so selected image engine is used before Higgsfield video.
old_video='''  if(format==='video'){
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
  }'''
new_video='''  if(format==='video'){
    const engine=selectedImageEngine();
    if($('higgsfieldGenerationStatus'))$('higgsfieldGenerationStatus').textContent=`Creating source image with ${engine==='openai'?'ChatGPT / OpenAI':'Higgsfield'}…`;
    const imageFn=engine==='openai'?'generate-openai-image':'generate-higgsfield-image';
    const imageBody=engine==='openai'?{prompt,aspect_ratio:'9:16',quality:'medium'}:{prompt,aspect_ratio:'9:16'};
    const img=await sb.functions.invoke(imageFn,{body:imageBody});
    if(img.error||!img.data?.ok)throw new Error(engine==='openai'?(img.data?.error||img.error?.message||'OpenAI source image generation failed'):hfError(img.error,img.data));
    const source=img.data.image_url||img.data.images?.[0]?.url; if(!source)throw new Error(`${engine==='openai'?'OpenAI':'Higgsfield'} returned no source image`);
    $('ideaSourceImageUrl').value=source;
    $('higgsfieldGenerationStatus').textContent='Source image ready ✓ · generating video with Higgsfield…';
    const vid=await sb.functions.invoke('generate-higgsfield-video',{body:{prompt,image_url:source}});
    if(vid.error||!vid.data?.ok)throw new Error(hfError(vid.error,vid.data));
    const url=vid.data.video_url||vid.data.videos?.[0]?.url; if(!url)throw new Error('Higgsfield returned no video URL');
    $('ideaMediaUrl').value=url; setHiggsfieldPreview(url,'video');
    $('higgsfieldGenerationStatus').textContent=`Video generated ✓ · source: ${engine==='openai'?'ChatGPT / OpenAI':'Higgsfield'} · video: Higgsfield`; return true;
  }'''
if old_video in s:
    s=s.replace(old_video,new_video,1)

# Keep helper copy synchronized when user switches engines/formats.
bind_old="if($('ideaFormat'))$('ideaFormat').addEventListener('change',()=>{updateCreativeBadge();renderReadyPost();});"
bind_new=bind_old+"\n  if($('imageEngine'))$('imageEngine').addEventListener('change',()=>{const h=$('imageEngineHelp');if(h)h.textContent=selectedImageEngine()==='openai'?'ChatGPT / OpenAI will generate images; Higgsfield still creates final videos.':'Higgsfield will generate images and final videos.';});"
s=s.replace(bind_old,bind_new,1)

p.write_text(s)
print('added selectable OpenAI/Higgsfield image engine')
