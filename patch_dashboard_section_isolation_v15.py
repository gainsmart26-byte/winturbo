from pathlib import Path

p=Path('dashboard.html')
s=p.read_text()

verification='''<section id="verification" class="section">
  <div class="sectionHead"><div><h2 style="margin:0">Verification</h2><div class="muted small">Connection and publishing readiness for WinTurbo services.</div></div><span class="pill blue">CONNECTIONS</span></div>
  <div class="grid2">
    <div class="card"><div class="sectionHead"><div><h3 style="margin:0">Telegram Publishing</h3><div class="muted small">Direct publishing to the connected WinTurbo Telegram channel.</div></div><span id="telegramPublishStatus" class="pill orange">NOT CONNECTED</span></div><div class="grid2"><div><div class="k">Publishing Accounts</div><div id="telegramPublishingAccounts" class="v" style="font-size:19px">0</div><div class="subv">Current destination: @winturbonow</div></div><div><div class="k">Permission Check</div><div id="telegramPermissionDetail" class="v" style="font-size:16px">Not verified</div><div class="subv">Bot · Channel · Admin · Can post</div></div></div><button id="verifyTelegramConnection" class="primary">Verify Telegram Connection</button><div id="telegramVerifyMessage" class="subv" style="margin-top:8px">Uses the secure server-side bot token.</div></div>
    <div class="card"><div class="sectionHead"><div><h3 style="margin:0">Instagram Publishing</h3><div class="muted small">Meta professional-account publishing connection.</div></div><span class="pill orange">SETUP REQUIRED</span></div><div class="k">Status</div><div class="v" style="font-size:19px">Not connected</div><div class="subv">Connect an Instagram professional account through Meta before direct publishing is enabled.</div><button class="ghost" style="margin-top:14px" disabled>Instagram Connection Pending</button></div>
  </div>
  <div class="grid2">
    <div class="card"><div class="sectionHead"><div><h3 style="margin:0">ChatGPT Content Generation</h3><div class="muted small">Server-side OpenAI copy generation for Content Ideas.</div></div><span class="pill">READY</span></div><div class="subv">Creates original Telegram and Instagram copy from your brief.</div></div>
    <div class="card"><div class="sectionHead"><div><h3 style="margin:0">Media Generation</h3><div class="muted small">OpenAI image generation and Higgsfield image/video generation.</div></div><span class="pill">READY</span></div><div class="subv">Image engine can be selected in Content Ideas. Video generation uses Higgsfield.</div></div>
  </div>
</section>'''

content='''<section id="contentIdeas" class="section">
  <div class="sectionHead"><div><h2 style="margin:0">Content Ideas</h2><div class="muted small">Create copy and the selected creative automatically, then review everything together before posting.</div></div><span class="pill">AI WORKSPACE</span></div>
  <div class="grid2">
    <div class="card">
      <h3>1. Build the idea</h3>
      <div class="grid2"><div><div class="k">Content Type</div><select id="ideaType"><option value="idea">Idea</option><option value="topic">Topic</option><option value="keywords">Keywords</option><option value="event">Event</option><option value="link">Site Link</option></select></div><div><div class="k">Primary Platform</div><select id="ideaPlatform"><option value="telegram">Telegram</option><option value="instagram">Instagram</option></select></div></div>
      <div class="k" style="margin-top:12px">Idea / Topic / Keywords / Event / Link</div><textarea id="ideaInput" style="min-height:110px" placeholder="Example: IPL weekend match, fastest withdrawal experience, 24×7 support, first-deposit offer, or paste a website link"></textarea>
      <div class="grid2"><div><div class="k">Tone</div><select id="ideaTone"><option>Premium & confident</option><option>Gen Z & energetic</option><option>Trust-led</option><option>Short & urgent</option><option>Informative</option></select></div><div><div class="k">Creative Format</div><select id="ideaFormat"><option value="image">Image Post</option><option value="video">Short Video / Reel</option><option value="text">Text Only</option></select></div></div>
      <div style="margin-top:12px"><div class="k">Image Engine</div><select id="imageEngine"><option value="openai">ChatGPT / OpenAI Image</option><option value="higgsfield">Higgsfield Image</option></select><div id="imageEngineHelp" class="subv">Used for Image Post generation and as the source image for Video / Reel generation.</div></div>
      <button id="generateIdeaContent" class="primary" style="width:100%;margin-top:12px">Generate with ChatGPT + Creative</button><div id="ideaStatus" class="subv" style="margin-top:8px">The selected creative format will be generated automatically after the copy.</div>
    </div>
    <div class="card"><h3>2. AI Draft</h3><textarea id="ideaDraft" style="min-height:240px" placeholder="Generated content will appear here. You can edit it before publishing."></textarea><div class="modalActions" style="justify-content:flex-start"><button id="copyIdeaDraft" class="ghost">Copy Draft</button><button id="regenerateIdeaContent" class="ghost">Regenerate All</button></div><div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px"><div class="sectionHead"><div><h3 style="margin:0">Generated Creative</h3><div id="higgsfieldGenerationStatus" class="subv">Waiting for generation.</div></div><span id="creativeFormatBadge" class="pill blue">IMAGE</span></div><div id="higgsfieldPreview" style="margin-top:10px"></div></div></div>
  </div>
  <div class="card" style="margin-top:14px"><div class="sectionHead"><div><h3 style="margin:0">3. Ready to Post</h3><div class="muted small">Final copy and generated media shown together for approval.</div></div><span class="pill">READY WORKSPACE</span></div><div class="grid2"><div><div class="k">Post Content</div><div id="readyPostCopy" style="white-space:pre-wrap;min-height:180px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#0b100d" class="small muted">Generate content to preview the final post.</div></div><div><div class="k">Creative</div><div id="readyPostMedia" style="min-height:180px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#0b100d;display:grid;place-items:center" class="small muted">Generated image or video will appear here.</div></div></div><input id="ideaMediaUrl" type="hidden"><input id="ideaSourceImageUrl" type="hidden"><textarea id="higgsfieldPrompt" class="hide"></textarea><div class="modalActions" style="justify-content:flex-start;margin-top:14px"><button id="publishIdeaTelegram" class="primary">Post to Telegram</button><button id="publishIdeaInstagram" class="ghost" disabled>Post to Instagram · Connect Meta First</button><button id="regenerateCreativeOnly" class="ghost">Regenerate Creative</button></div><div id="ideaPublishStatus" class="subv" style="margin-top:8px">Nothing is posted until you approve it.</div></div>
</section>'''

# Replace everything from Verification through Content Ideas with clean standalone sections.
v=s.find('<section id="verification"')
c=s.find('<section id="contentIdeas"')
if v==-1 or c==-1 or c<v:
    raise SystemExit('verification/contentIdeas sections not found in expected order')
end=s.find('</main>',c)
if end==-1:
    raise SystemExit('main closing tag not found')
# Preserve anything between the end of Content Ideas and </main> only if it is not stray markup; canonical final tabs should end here.
s=s[:v]+verification+'\n'+content+'\n'+s[end:]

# Ensure these section IDs occur exactly once.
for sec_id in ('verification','contentIdeas'):
    if s.count(f'id="{sec_id}"') != 1:
        raise SystemExit(f'duplicate section id remains: {sec_id}')

p.write_text(s)
print('isolated Verification and Content Ideas from Data Quality content')
