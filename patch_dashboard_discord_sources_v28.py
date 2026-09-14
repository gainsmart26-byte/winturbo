from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Add Discord to the source selector.
if '<option>Discord</option>' not in s:
    s=s.replace('<option>Telegram</option><option>Instagram</option><option>Public Web</option>', '<option>Telegram</option><option>Instagram</option><option>Discord</option><option>Public Web</option>', 1)

# Add Discord navigation entry beside the other source tabs.
if 'data-s="discordSources"' not in s:
    s=s.replace('<button data-s="otherSources">◎ Instagram & Web</button>', '<button data-s="otherSources">◎ Instagram & Web</button><button data-s="discordSources">◈ Discord Sources</button>', 1)

# Add Discord section before Posting Intelligence.
if 'id="discordSources"' not in s:
    section=r'''
<section id="discordSources" class="section">
  <div class="sectionHead"><div><h2>Discord Sources</h2><div class="muted small">Monitor Discord servers/channels and feed accessible messages into WinTurbo content, timing and AI analytics.</div></div><span class="pill blue">DISCORD</span></div>
  <div class="grid4">
    <div class="card"><div class="k">ACTIVE DISCORD LINKS</div><div class="v" id="discordSourceCount">0</div><div class="subv">Configured Discord sources</div></div>
    <div class="card"><div class="k">MESSAGES · 7 DAYS</div><div class="v" id="discordPostCount">0</div><div class="subv">Messages available to analytics</div></div>
    <div class="card"><div class="k">LAST UPDATE</div><div class="v" id="discordLastUpdate" style="font-size:18px">—</div><div class="subv">Latest successful Discord collection</div></div>
    <div class="card"><div class="k">BOT ACCESS</div><div class="v" id="discordAccess" style="font-size:18px">Not connected</div><div class="subv">Bot must be allowed to read each channel</div></div>
  </div>
  <div class="card" style="margin-top:14px">
    <div class="sectionHead"><div><h3>Monitored Discord Channels</h3><div class="muted small">Use a channel URL such as https://discord.com/channels/server_id/channel_id. Invite links can be saved, but message history requires bot access.</div></div><button id="addDiscordSource" class="primary">+ Add Discord Source</button></div>
    <div class="tableWrap"><table><thead><tr><th>Server / Channel</th><th>Channel ID</th><th>Status</th><th>Last Updated</th><th>7D Messages</th><th>Top Reactions</th><th>Open</th><th>Collect</th></tr></thead><tbody id="discordSourcesBody"><tr><td colspan="8" class="muted">No Discord sources configured yet.</td></tr></tbody></table></div>
  </div>
  <div class="card" style="margin-top:14px"><div class="sectionHead"><div><h3>Discord Analytics Coverage</h3><div class="muted small">Once collected, Discord messages automatically participate in Creative Explorer, Posting Intelligence, Content Topic Analytics and AI recommendations.</div></div></div><div id="discordCoverage" class="muted small">Waiting for an accessible Discord channel.</div></div>
</section>
'''
    marker='<section id="timing" class="section">'
    if marker not in s:
        raise SystemExit('timing section marker not found')
    s=s.replace(marker,section+'\n'+marker,1)

# Make the v23 navigation runtime aware of Discord.
s=s.replace("const IDS=['overview','growth','creative','telegramSources','otherSources','timing','quality','verification','contentIdeas','approval'];", "const IDS=['overview','growth','creative','telegramSources','otherSources','discordSources','timing','quality','verification','contentIdeas','approval'];")
s=s.replace("otherSources:'Instagram & Web',timing:'Posting Intelligence'", "otherSources:'Instagram & Web',discordSources:'Discord Sources',timing:'Posting Intelligence'")

# Remove an older v28 runtime if the patch is re-run.
s=re.sub(r'<script>\s*/\* WINTURBO_DISCORD_V28_START \*/.*?/\* WINTURBO_DISCORD_V28_END \*/\s*</script>','',s,flags=re.S)

runtime=r'''
<script>
/* WINTURBO_DISCORD_V28_START */
(function(){
  const isDiscord=x=>String(x?.platform||'').toLowerCase()==='discord';
  const discordHandleFromUrl=raw=>{try{const u=new URL(raw);const p=u.pathname.split('/').filter(Boolean);if(p[0]==='channels'&&p[1]&&p[2])return `${p[1]}/${p[2]}`;}catch{}return null};
  const discordPostsFor=(src,cut)=>{const h=src.handle||discordHandleFromUrl(src.source_url);return (window.allCreative||allCreative||[]).filter(r=>r.posted_at&&new Date(r.posted_at).getTime()>=cut&&(String(r.platform||'').toLowerCase()==='discord'||(h&&r.handle===h)||String(r.account_name||'').toLowerCase()===String(src.source_name||'').toLowerCase()))};
  const maxDate=list=>list.map(x=>x.last_scraped_at).filter(Boolean).sort().pop();

  async function collectDiscordSource(id,button){
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Collecting…'}
    try{
      const {data,error}=await sb.functions.invoke('discord-collector',{body:{action:'ingest_source',source_id:id}});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'Discord collection failed');
      if(button)button.textContent=`${data.messages_ingested||0} collected ✓`;
      await loadSources(); if(typeof loadCreative==='function')await loadCreative(); if(typeof loadGrowth==='function')await loadGrowth(); if(typeof loadSuccess==='function')await loadSuccess();
      renderDiscordSourcesV28(); if(typeof renderAll==='function')setTimeout(()=>renderAll(),50);
    }catch(e){alert(`Discord collection: ${e?.message||e}`);if(button)button.textContent=old||'Collect now'}finally{if(button){button.disabled=false;setTimeout(()=>button.textContent=old||'Collect now',1400)}}
  }
  window.collectDiscordSource=collectDiscordSource;

  function renderDiscordSourcesV28(){
    if(!document.getElementById('discordSourcesBody'))return;
    const cut=Date.now()-7*86400000;
    const sources=(window.allSources||allSources||[]).filter(x=>x.is_active!==false&&isDiscord(x));
    const allPosts=[];sources.forEach(x=>discordPostsFor(x,cut).forEach(p=>allPosts.push(p)));
    const uniq=new Map(allPosts.map(p=>[`${p.handle||''}:${p.platform_post_id||p.post_url||''}`,p]));
    const posts=[...uniq.values()];
    const accessible=sources.filter(x=>x.scrape_status==='active').length;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
    set('discordSourceCount',sources.length);
    set('discordPostCount',posts.length);
    const last=maxDate(sources);set('discordLastUpdate',last?dateFmt(last):'—');
    set('discordAccess',sources.length?(accessible===sources.length?'Connected':`${accessible}/${sources.length} active`):'Not connected');
    const body=document.getElementById('discordSourcesBody');
    body.innerHTML=sources.length?sources.map(src=>{
      const p=discordPostsFor(src,cut),top=[...p].sort((a,b)=>Number(b.reactions_count||0)-Number(a.reactions_count||0))[0];
      const handle=src.handle||discordHandleFromUrl(src.source_url)||'—';
      const cls=src.scrape_status==='active'?'':'orange';
      const status=src.scrape_status||'needs_bot_access';
      return `<tr><td><b>${esc(src.source_name||'Discord channel')}</b><div class="muted small">${esc(src.last_error||'Discord source')}</div></td><td>${esc(handle)}</td><td><span class="pill ${cls}">${esc(status.replaceAll('_',' '))}</span></td><td>${src.last_scraped_at?dateFmt(src.last_scraped_at):'—'}</td><td>${fmt.format(p.length)}</td><td>${top?.reactions_count!=null?fmt.format(top.reactions_count):'—'}</td><td>${src.source_url?`<a target="_blank" rel="noopener noreferrer" href="${esc(src.source_url)}">Open ↗</a>`:'—'}</td><td><button class="mini" onclick="collectDiscordSource('${esc(src.id)}',this)">Collect now</button></td></tr>`;
    }).join(''):'<tr><td colspan="8" class="muted">No Discord sources configured yet. Add a Discord channel URL to begin.</td></tr>';
    const coverage=document.getElementById('discordCoverage');
    if(coverage)coverage.innerHTML=posts.length?`<b>${fmt.format(posts.length)}</b> Discord messages are currently available to shared analytics. Reactions, message timing, media type, topic and creative score flow into the same normalized intelligence views.`:'No Discord messages have been ingested yet. Save a source and give the WinTurbo Discord bot access to the server/channel.';
  }
  window.renderDiscordSourcesV28=renderDiscordSourcesV28;

  const oldRenderAll=typeof renderAll==='function'?renderAll:null;
  if(oldRenderAll){window.renderAll=function(){oldRenderAll();renderDiscordSourcesV28()}}

  function ensureDiscordControls(){
    const platform=document.getElementById('sourcePlatform');
    if(platform&&!Array.from(platform.options).some(o=>o.value==='Discord'||o.text==='Discord')){const o=document.createElement('option');o.text='Discord';o.value='Discord';platform.insertBefore(o,platform.lastElementChild)}
    const add=document.getElementById('addDiscordSource');if(add&&!add.dataset.bound){add.dataset.bound='1';add.onclick=()=>{document.getElementById('sourceModal')?.classList.remove('hide');if(platform)platform.value='Discord';const input=document.getElementById('sourceUrl');if(input)input.placeholder='https://discord.com/channels/server_id/channel_id';const msg=document.getElementById('sourceMsg');if(msg)msg.textContent='Discord message history requires the WinTurbo Discord bot to have permission to read the channel.'}}
    if(platform&&!platform.dataset.discordBound){platform.dataset.discordBound='1';platform.addEventListener('change',()=>{const input=document.getElementById('sourceUrl');if(!input)return;input.placeholder=platform.value==='Discord'?'https://discord.com/channels/server_id/channel_id':platform.value==='Telegram'?'https://t.me/channelname':'https://...'});}
  }

  const save=document.getElementById('saveSource');
  if(save){save.onclick=async()=>{
    const raw=document.getElementById('sourceUrl')?.value.trim()||'',name=document.getElementById('sourceName')?.value.trim()||'',platform=document.getElementById('sourcePlatform')?.value||'Public Web',msg=document.getElementById('sourceMsg');
    if(!/^https?:\/\//i.test(raw)){if(msg)msg.innerHTML='<span class="error">Enter a valid public http/https URL.</span>';return}
    if(msg)msg.textContent='Adding source…';
    const {data:{user}}=await sb.auth.getUser();let handle=null;
    try{const u=new URL(raw),parts=u.pathname.split('/').filter(Boolean);if(platform==='Telegram'&&u.hostname.includes('t.me'))handle=u.pathname.replace(/^\/s\//,'').replace(/^\//,'').split('/')[0]||null;else if(platform==='Discord'&&parts[0]==='channels'&&parts[1]&&parts[2])handle=`${parts[1]}/${parts[2]}`;else if(platform==='Instagram')handle=parts[0]||null;}catch{}
    const initialStatus=platform==='Discord'?'needs_bot_access':'queued';
    const {data,error}=await sb.from('monitored_sources').insert({source_url:raw,platform,source_name:name||handle||raw,handle,created_by:user?.id||null,scrape_status:initialStatus,is_active:true}).select('id').single();
    if(error){if(msg)msg.innerHTML=`<span class="error">${esc(error.message)}</span>`;return}
    if(platform==='Discord'){
      if(msg)msg.textContent='Discord source saved · checking bot access…';
      try{const r=await sb.functions.invoke('discord-collector',{body:{action:'ingest_source',source_id:data.id}});if(r.error)throw r.error;if(!r.data?.ok)throw new Error(r.data?.error||'Bot access required');if(msg)msg.textContent=`Discord connected ✓ · ${r.data.messages_ingested||0} messages collected from the last 7 days.`}catch(e){if(msg)msg.textContent=`Discord source saved. Bot access is still required before messages can be collected: ${e?.message||e}`}
    }else if(msg)msg.textContent='Added. The scheduled collector will backfill up to the last 7 days where available.';
    document.getElementById('sourceUrl').value='';document.getElementById('sourceName').value='';await loadSources();renderDiscordSourcesV28();if(typeof renderAll==='function')renderAll();if(platform!=='Discord')setTimeout(()=>document.getElementById('sourceModal')?.classList.add('hide'),900);
  }}

  ensureDiscordControls();
  setTimeout(()=>{ensureDiscordControls();renderDiscordSourcesV28()},50);
})();
/* WINTURBO_DISCORD_V28_END */
</script>
'''

if '</body>' not in s:
    raise SystemExit('body closing tag not found')
s=s.replace('</body>',runtime+'\n</body>',1)

p.write_text(s,encoding='utf-8')
print('Discord Sources added with source management, collection controls and analytics integration.')
