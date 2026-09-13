from pathlib import Path

p=Path('dashboard.html')
s=p.read_text()

# Add new navigation tabs.
s=s.replace('<button data-s="quality">✓ Data Quality & AI</button>', '<button data-s="quality">✓ Data Quality & AI</button><button data-s="verification">✓ Verification</button><button data-s="contentIdeas">✦ Content Ideas</button>', 1)

# Remove Telegram Publishing card from Data Quality & AI (it will live in Verification).
start=s.find('<div class="card" style="margin-bottom:13px"><div class="sectionHead"><div><h3>Telegram Publishing</h3>')
if start!=-1:
    end=s.find('<div class="card" style="margin-bottom:13px"><div class="sectionHead"><div><h3>Likely to Be Successful — AI Intelligence</h3>', start)
    if end!=-1:
        s=s[:start]+s[end:]

verification='''
<section id="verification" class="section">
  <div class="sectionHead"><div><h2 style="margin:0">Verification</h2><div class="muted small">Connection and publishing readiness for WinTurbo channels and creative services.</div></div><span class="pill blue">CONNECTIONS</span></div>
  <div class="grid2">
    <div class="card"><div class="sectionHead"><div><h3>Telegram Publishing</h3><div class="muted small">Direct publishing to the connected WinTurbo Telegram channel.</div></div><span id="telegramPublishStatus" class="pill orange">NOT CONNECTED</span></div><div class="grid2"><div><div class="k">Publishing Accounts</div><div id="telegramPublishingAccounts" class="v" style="font-size:19px">0</div><div class="subv">Current destination: @winturbonow</div></div><div><div class="k">Permission Check</div><div id="telegramPermissionDetail" class="v" style="font-size:16px">Not verified</div><div class="subv">Bot · Channel · Admin · Can post</div></div></div><button id="verifyTelegramConnection" class="primary">Verify Telegram Connection</button><div id="telegramVerifyMessage" class="subv" style="margin-top:8px">Uses the secure server-side bot token.</div></div>
    <div class="card"><div class="sectionHead"><div><h3>Instagram Publishing</h3><div class="muted small">Meta professional-account publishing connection.</div></div><span class="pill orange">SETUP REQUIRED</span></div><div class="k">Status</div><div class="v" style="font-size:19px">Not connected</div><div class="subv">Connect an Instagram professional account through Meta before direct publishing is enabled.</div><button class="ghost" style="margin-top:14px" disabled>Instagram Connection Pending</button></div>
  </div>
  <div class="grid2">
    <div class="card"><div class="sectionHead"><div><h3>ChatGPT Content Generation</h3><div class="muted small">Powered by the existing server-side OpenAI generation function.</div></div><span class="pill">READY</span></div><div class="subv">Used by Content Ideas for Telegram and Instagram copy.</div></div>
    <div class="card"><div class="sectionHead"><div><h3>Higgsfield Media</h3><div class="muted small">Generate image/video prompts and continue in Higgsfield.</div></div><span class="pill blue">BRIDGE</span></div><div class="subv">The dashboard can prepare/copy prompts and open Higgsfield. Direct inline generation requires a Higgsfield API/SDK credential configured server-side.</div><a class="ghost" style="display:inline-block;margin-top:14px" target="_blank" rel="noopener" href="https://higgsfield.ai/">Open Higgsfield ↗</a></div>
  </div>
</section>
'''

content='''
<section id="contentIdeas" class="section">
  <div class="sectionHead"><div><h2 style="margin:0">Content Ideas</h2><div class="muted small">Create original WinTurbo content from an idea, topic, keywords, event or site link, then generate media and publish.</div></div><span class="pill">AI WORKSPACE</span></div>
  <div class="grid2">
    <div class="card"><h3>1. Build the idea</h3><div class="grid2"><div><div class="k">Content Type</div><select id="ideaType"><option value="idea">Idea</option><option value="topic">Topic</option><option value="keywords">Keywords</option><option value="event">Event</option><option value="link">Site Link</option></select></div><div><div class="k">Primary Platform</div><select id="ideaPlatform"><option value="telegram">Telegram</option><option value="instagram">Instagram</option></select></div></div><div class="k" style="margin-top:12px">Idea / Topic / Keywords / Event / Link</div><textarea id="ideaInput" style="min-height:110px" placeholder="Example: IPL weekend match, fastest withdrawal experience, 24×7 support, first-deposit offer, or paste a website link"></textarea><div class="grid2"><div><div class="k">Tone</div><select id="ideaTone"><option>Premium & confident</option><option>Gen Z & energetic</option><option>Trust-led</option><option>Short & urgent</option><option>Informative</option></select></div><div><div class="k">Creative Format</div><select id="ideaFormat"><option value="image">Image Post</option><option value="video">Short Video / Reel</option><option value="text">Text Only</option></select></div></div><button id="generateIdeaContent" class="primary" style="width:100%;margin-top:10px">Generate with ChatGPT</button><div id="ideaStatus" class="subv" style="margin-top:8px">Original copy only. No competitor wording is copied.</div></div>
    <div class="card"><h3>2. AI draft</h3><textarea id="ideaDraft" style="min-height:280px" placeholder="Generated content will appear here. You can edit it before publishing."></textarea><div class="modalActions" style="justify-content:flex-start"><button id="copyIdeaDraft" class="ghost">Copy Draft</button><button id="regenerateIdeaContent" class="ghost">Regenerate</button></div></div>
  </div>
  <div class="grid2">
    <div class="card"><h3>3. Create image or video</h3><div class="k">Higgsfield Prompt</div><textarea id="higgsfieldPrompt" style="min-height:160px" placeholder="A media prompt will be prepared from your content idea."></textarea><div class="modalActions" style="justify-content:flex-start"><button id="buildMediaPrompt" class="ghost">Build Media Prompt</button><button id="openHiggsfield" class="primary">Copy Prompt & Open Higgsfield</button></div><div class="k" style="margin-top:12px">Generated Media URL</div><input id="ideaMediaUrl" placeholder="Paste final image/video URL here after generation"><div class="subv">Direct media generation inside WinTurbo can be added once Higgsfield API/SDK access is configured server-side.</div></div>
    <div class="card"><h3>4. Publish</h3><div class="k">Destination</div><div class="v" style="font-size:19px">Telegram · @winturbonow</div><div class="subv">Posts only after manual approval.</div><button id="publishIdeaTelegram" class="primary" style="width:100%;margin-top:14px">Post to Telegram</button><button id="publishIdeaInstagram" class="ghost" style="width:100%;margin-top:8px" disabled>Post to Instagram · Connect Meta First</button><div id="ideaPublishStatus" class="subv" style="margin-top:10px">No content is posted automatically.</div></div>
  </div>
</section>
'''

s=s.replace('</main></div>', verification+content+'</main></div>', 1)

js=r'''

async function generateContentIdea(){
  const input=$('ideaInput')?.value.trim(); if(!input){alert('Enter an idea, topic, keywords, event or site link first.');return}
  const platform=$('ideaPlatform')?.value||'telegram';
  const type=$('ideaType')?.value||'idea'; const tone=$('ideaTone')?.value||'Premium & confident'; const format=$('ideaFormat')?.value||'image';
  const btn=$('generateIdeaContent'); const old=btn.textContent; btn.disabled=true; btn.textContent='Generating…';
  if($('ideaStatus'))$('ideaStatus').textContent='ChatGPT is creating an original WinTurbo draft…';
  try{
    const recommendation={theme:`${type}: ${input}`,media_type:format,hook_direction:`Use this source brief: ${input}`,cta_direction:`Tone: ${tone}. Create a clear WinTurbo call to action.`,confidence:'User-directed'};
    const evidence=[{account_name:'User brief',post_text:input}];
    const{data,error}=await sb.functions.invoke('generate-social-post',{body:{platform,recommendation,evidence}});
    if(error)throw error; if(!data?.ok)throw new Error(data?.error||'Content generation failed');
    $('ideaDraft').value=data.text||''; buildIdeaMediaPrompt();
    if($('ideaStatus'))$('ideaStatus').textContent=`Generated for ${platform} · ${data.model||'OpenAI'}`;
  }catch(e){if($('ideaStatus'))$('ideaStatus').textContent=`Generation failed: ${e?.message||e}`}
  finally{btn.disabled=false;btn.textContent=old}
}
function buildIdeaMediaPrompt(){
  const input=$('ideaInput')?.value.trim()||''; const draft=$('ideaDraft')?.value.trim()||''; const format=$('ideaFormat')?.value||'image'; const tone=$('ideaTone')?.value||'Premium & confident';
  const ratio=format==='video'?'9:16 vertical':'1:1 social';
  const prompt=`Create a premium WinTurbo ${format} creative for social media. Brief: ${input}. Messaging context: ${draft.slice(0,650)}. Visual tone: ${tone}. Format: ${ratio}. Indian audience, bold modern Gen-Z gaming aesthetic, premium trustworthy presentation, strong readable hierarchy, no fake receipts, no fabricated claims, avoid clutter. Include WinTurbo branding naturally. For video: cinematic movement, Indian-English-friendly pacing, clear subtitle-safe lower area, 8-10 seconds.`;
  if($('higgsfieldPrompt'))$('higgsfieldPrompt').value=prompt; return prompt;
}
async function openIdeaHiggsfield(){const prompt=buildIdeaMediaPrompt();try{await navigator.clipboard.writeText(prompt)}catch{}window.open('https://higgsfield.ai/','_blank','noopener')}
async function publishIdeaTelegram(){
  const text=$('ideaDraft')?.value.trim(); if(!text){alert('Generate or enter content first.');return}
  const account=allPublishingAccounts.find(x=>x.connection_status==='connected')||allPublishingAccounts[0]; if(!account){alert('Telegram publishing account is not configured.');return}
  if(account.connection_status!=='connected'){alert('Verify Telegram in the Verification tab before publishing.');return}
  if(!confirm(`Publish this content now to @${account.username||'winturbonow'}?`))return;
  const btn=$('publishIdeaTelegram'), old=btn.textContent; btn.disabled=true; btn.textContent='Publishing…';
  try{
    const{data:{user}}=await sb.auth.getUser(); const mediaUrl=$('ideaMediaUrl')?.value.trim()||null; const fmt=$('ideaFormat')?.value||'text';
    const mediaType=mediaUrl?(fmt==='video'?'video':'photo'):null;
    const{data:q,error:qErr}=await sb.from('publishing_queue').insert({platform:'telegram',publishing_account_id:account.id,content_text:text,status:'approved',media_url:mediaUrl,media_type:mediaType,created_by:user?.id||null}).select('id').single();
    if(qErr)throw qErr; const{data,error}=await sb.functions.invoke('publish-telegram',{body:{action:'publish',queue_id:q.id}}); if(error)throw error; if(!data?.ok)throw new Error(data?.error||'Telegram publish failed');
    if($('ideaPublishStatus'))$('ideaPublishStatus').innerHTML=`Published ✓${data.published_url?` · <a target="_blank" rel="noopener" href="${esc(data.published_url)}">Open post ↗</a>`:''}`;
  }catch(e){if($('ideaPublishStatus'))$('ideaPublishStatus').textContent=`Publish failed: ${e?.message||e}`}
  finally{btn.disabled=false;btn.textContent=old}
}
if($('generateIdeaContent'))$('generateIdeaContent').onclick=generateContentIdea;
if($('regenerateIdeaContent'))$('regenerateIdeaContent').onclick=generateContentIdea;
if($('copyIdeaDraft'))$('copyIdeaDraft').onclick=async()=>{try{await navigator.clipboard.writeText($('ideaDraft').value);$('copyIdeaDraft').textContent='Copied ✓';setTimeout(()=>$('copyIdeaDraft').textContent='Copy Draft',1200)}catch{}};
if($('buildMediaPrompt'))$('buildMediaPrompt').onclick=buildIdeaMediaPrompt;
if($('openHiggsfield'))$('openHiggsfield').onclick=openIdeaHiggsfield;
if($('publishIdeaTelegram'))$('publishIdeaTelegram').onclick=publishIdeaTelegram;
'''

s=s.replace('</script>', js+'\n</script>', 1)

p.write_text(s)
print('dashboard verification + content ideas v7 patched')
