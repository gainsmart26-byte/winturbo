from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Idempotency.
s=re.sub(r'\n?/\* WINTURBO_MEDIA_ROUTING_V32_CSS \*/.*?(?=\n/\*|\n</style>)','',s,flags=re.S)
s=re.sub(r'<script>\s*/\* WINTURBO_MEDIA_ROUTING_V32_START \*/.*?/\* WINTURBO_MEDIA_ROUTING_V32_END \*/\s*</script>','',s,flags=re.S)

# Hard rule: every image request in the dashboard uses the ChatGPT/OpenAI image function.
# Video generation remains Higgsfield.
s=s.replace('generate-higgsfield-image','generate-openai-image')

# Content Ideas: remove selectable image engine and present fixed provider routing.
s=re.sub(
    r'<div id="ideaEngineWrap"[^>]*>.*?<select id="ideaEngine">.*?</select>\s*</div>',
    '''<div id="ideaEngineWrap" class="mediaRoutingBox" style="margin-top:12px">
      <div class="k">Creative Routing</div>
      <div class="mediaRoutingRow"><span>🖼️ Images</span><b>ChatGPT Image</b><span class="pill">FIXED</span></div>
      <div class="mediaRoutingRow"><span>🎬 Reels & Videos</span><b>Higgsfield</b><span class="pill blue">FIXED</span></div>
      <div class="muted small" style="margin-top:7px">Image generation always uses the ChatGPT image API. Video generation always uses Higgsfield.</div>
    </div>''',
    s,flags=re.S
)

# Update the v27 runtime so no removed selector can fall back to Higgsfield for images.
s=s.replace("const engine=()=> $('ideaEngine')?.value||'higgsfield';","const engine=()=> 'openai';")
s=s.replace("if($('ideaEngine'))$('ideaEngine').onchange=syncUi;","")

# Normalize user-facing labels without touching video routing.
repls={
    'Higgsfield Image':'ChatGPT Image',
    'Higgsfield image':'ChatGPT image',
    'Generate Image · Higgsfield':'Generate Image · ChatGPT',
    'Generate Higgsfield Image':'Generate ChatGPT Image',
    'Image Engine':'Image Provider',
    'OpenAI Image':'ChatGPT Image',
}
for a,b in repls.items():
    s=s.replace(a,b)

css=r'''
/* WINTURBO_MEDIA_ROUTING_V32_CSS */
.mediaRoutingBox{padding:12px;border:1px solid var(--line);background:#09100b;border-radius:12px}
.mediaRoutingRow{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #1d2820}
.mediaRoutingRow:last-of-type{border-bottom:0}.mediaRoutingRow b{color:#e9fff0}
#contentIdeas select#ideaEngine{display:none!important}
'''
s=s.replace('</style>',css+'\n</style>',1)

js=r'''
<script>
/* WINTURBO_MEDIA_ROUTING_V32_START */
(function(){
  const $=id=>document.getElementById(id);
  function enforce(){
    // Remove any legacy image-engine selector that may be dynamically reinserted.
    const sel=$('ideaEngine');if(sel){sel.value='openai';sel.disabled=true;sel.style.display='none';}
    document.querySelectorAll('button').forEach(btn=>{
      const t=(btn.textContent||'').trim();
      if(/higgsfield\s+image/i.test(t))btn.textContent=t.replace(/higgsfield\s+image/ig,'ChatGPT Image');
    });
    const st=$('higgsfieldGenerationStatus');
    if(st && /image/i.test(st.textContent||'') && /higgsfield/i.test(st.textContent||'')){
      st.textContent=(st.textContent||'').replace(/Higgsfield/ig,'ChatGPT');
    }
  }
  window.WinTurboMediaRouting={imageProvider:'ChatGPT Image API',videoProvider:'Higgsfield'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enforce,{once:true});else enforce();
  setTimeout(enforce,300);setTimeout(enforce,1200);
})();
/* WINTURBO_MEDIA_ROUTING_V32_END */
</script>
'''
s=s.replace('</body>',js+'\n</body>',1)

p.write_text(s,encoding='utf-8')
print('Media routing v32: all images -> ChatGPT image API; all reels/videos -> Higgsfield.')
