from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text()

# Source-specific top-level navigation.
s=s.replace('<button data-s="creative">✦ Creative Explorer</button><button data-s="timing">◷ Posting Intelligence</button>', '<button data-s="creative">✦ Creative Explorer</button><button data-s="telegramSources">✈ Telegram Sources</button><button data-s="otherSources">◎ Instagram & Web</button><button data-s="timing">◷ Posting Intelligence</button>')

source_sections='''<section id="telegramSources" class="section"><div class="grid4"><div class="card"><div class="k">Active Telegram Links</div><div id="tgSourceCount" class="v">—</div></div><div class="card"><div class="k">Telegram Posts · 7D</div><div id="tgPostCount" class="v">—</div></div><div class="card"><div class="k">Latest Telegram Update</div><div id="tgLastUpdate" class="v" style="font-size:18px">—</div></div><div class="card"><div class="k">Collector</div><div class="v" style="font-size:18px">Public + Auth Fallback</div><div class="subv">Only authorized/publicly accessible data</div></div></div><div class="card"><div class="sectionHead"><div><h3>Telegram Source Intelligence</h3><div class="muted small">Telegram links, collection status and observed post coverage.</div></div><span class="pill">TELEGRAM</span></div><div class="tableWrap"><table><thead><tr><th>Source</th><th>Handle</th><th>Status</th><th>Last Updated</th><th>Posts · 7D</th><th>Top Recent Views</th><th>Open</th></tr></thead><tbody id="tgSourcesBody"></tbody></table></div></div></section>
<section id="otherSources" class="section"><div class="grid4"><div class="card"><div class="k">Active Instagram/Web Links</div><div id="otherSourceCount" class="v">—</div></div><div class="card"><div class="k">Posts / Items · 7D</div><div id="otherPostCount" class="v">—</div></div><div class="card"><div class="k">Latest Source Update</div><div id="otherLastUpdate" class="v" style="font-size:18px">—</div></div><div class="card"><div class="k">Collectors</div><div class="v" style="font-size:18px">Apify + Firecrawl</div><div class="subv">Instagram and general web collection</div></div></div><div class="card"><div class="sectionHead"><div><h3>Instagram & Web Source Intelligence</h3><div class="muted small">Non-Telegram source coverage, status and observed content.</div></div><span class="pill blue">MULTI-SOURCE</span></div><div class="tableWrap"><table><thead><tr><th>Source</th><th>Type</th><th>Status</th><th>Last Updated</th><th>Items · 7D</th><th>Top Recent Views</th><th>Open</th></tr></thead><tbody id="otherSourcesBody"></tbody></table></div></div></section>
'''
s=s.replace('<section id="quality" class="section">', source_sections+'<section id="quality" class="section">',1)

# Data Quality now states exactly which collector/evidence family is being analyzed.
quality_intro='''<div class="grid4"><div class="card"><div class="k">Telegram Evidence</div><div class="v" style="font-size:18px">Public / Authorized</div><div class="subv">t.me pages with authenticated fallback where legitimately accessible</div></div><div class="card"><div class="k">Instagram Evidence</div><div class="v" style="font-size:18px">Apify</div><div class="subv">Public profile/post/reel observations when configured</div></div><div class="card"><div class="k">Web Evidence</div><div class="v" style="font-size:18px">Firecrawl / Apify</div><div class="subv">Public websites and landing pages</div></div><div class="card"><div class="k">AI Recommendation Output</div><div class="v" style="font-size:18px">Channel-Aware</div><div class="subv">Each idea shows analyzed source + recommended publishing channel</div></div></div>'''
s=s.replace('<section id="quality" class="section">','<section id="quality" class="section">'+quality_intro,1)

# Clickable executive cards.
s=s.replace('.sourceRow{display:flex;', '.clickCard{cursor:pointer;transition:transform .15s,border-color .15s}.clickCard:hover{transform:translateY(-2px);border-color:#42e36c}.sourceRow{display:flex;')

extra_js=r'''
function sourcePlatform(x){return String(x?.platform||'').toLowerCase()}
function postPlatform(r){return String(r?.platform||r?.source_platform||'').toLowerCase()}
function recommendedChannel(r){const m=String(r?.media_type||'').toLowerCase(),t=String(r?.theme||'').toLowerCase();if(m.includes('video')||m.includes('reel')||m.includes('carousel'))return 'Instagram';if(t.includes('alert')||t.includes('live')||t.includes('odds')||t.includes('entry')||t.includes('update'))return 'Telegram';return 'Telegram + Instagram'}
function renderSourceTabs(){const cut=Date.now()-7*86400000,active=allSources.filter(x=>x.is_active!==false),tg=active.filter(x=>sourcePlatform(x)==='telegram'),other=active.filter(x=>sourcePlatform(x)!=='telegram'),recent=allCreative.filter(r=>r.posted_at&&new Date(r.posted_at).getTime()>=cut);const rows=(list,isTg)=>list.map(x=>{const h=x.handle||'',posts=recent.filter(r=>h&&(r.handle===h||String(r.account_name||'').toLowerCase()===String(x.source_name||'').toLowerCase())),top=[...posts].sort((a,b)=>Number(b.views||0)-Number(a.views||0))[0];return `<tr><td><b>${esc(x.source_name||h||x.source_url||'Source')}</b></td><td>${isTg?'@'+esc(h):esc(x.handle||'—')}</td>${isTg?'':`<td>${esc(x.platform||'Web')}</td>`}<td><span class="pill ${x.scrape_status==='active'?'':'orange'}">${esc(x.scrape_status||'queued')}</span></td><td>${x.last_scraped_at?dateFmt(x.last_scraped_at):'—'}</td><td>${fmt.format(posts.length)}</td><td>${top?.views!=null?fmt.format(top.views):'—'}</td><td>${x.source_url?`<a target="_blank" rel="noopener" href="${esc(x.source_url)}">Open ↗</a>`:'—'}</td></tr>`}).join('');if($('tgSourceCount'))$('tgSourceCount').textContent=tg.length;if($('otherSourceCount'))$('otherSourceCount').textContent=other.length;const tgPosts=recent.filter(r=>postPlatform(r)==='telegram'||tg.some(x=>x.handle&&x.handle===r.handle)),otherPosts=recent.filter(r=>!(postPlatform(r)==='telegram'||tg.some(x=>x.handle&&x.handle===r.handle)));if($('tgPostCount'))$('tgPostCount').textContent=tgPosts.length;if($('otherPostCount'))$('otherPostCount').textContent=otherPosts.length;const maxDate=list=>list.map(x=>x.last_scraped_at).filter(Boolean).sort().pop();if($('tgLastUpdate'))$('tgLastUpdate').textContent=maxDate(tg)?dateFmt(maxDate(tg)):'—';if($('otherLastUpdate'))$('otherLastUpdate').textContent=maxDate(other)?dateFmt(maxDate(other)):'—';if($('tgSourcesBody'))$('tgSourcesBody').innerHTML=rows(tg,true)||'<tr><td colspan="7" class="muted">No active Telegram sources.</td></tr>';if($('otherSourcesBody'))$('otherSourcesBody').innerHTML=rows(other,false)||'<tr><td colspan="7" class="muted">No active Instagram or web sources yet.</td></tr>'}
function bindOverviewDrilldowns(){const map={accounts:'growth',members:'growth',overviewPosts:'creative',overviewTopScore:'creative',activeLinks:'telegramSources',posts24h:'creative',lastDataUpdate:'quality',topTopic:'creative'};Object.entries(map).forEach(([id,target])=>{const el=$(id),card=el?.closest('.card');if(!card||card.dataset.drillBound)return;card.dataset.drillBound='1';card.classList.add('clickCard');card.title='Click to drill down';card.onclick=()=>document.querySelector(`.nav button[data-s="${target}"]`)?.click()})}
'''
s=s.replace('function renderSources()', extra_js+'\nfunction renderSources()',1)

# Ensure new source sections render with every dashboard refresh.
s=s.replace('function renderAll(){', 'function renderAll(){renderSourceTabs();setTimeout(bindOverviewDrilldowns,0);',1)

# Add source/channel metadata to success-intelligence cards.
s=s.replace('<div class="recLine"><b>Why:</b> ${esc(r.rationale||\'Strong observed recent evidence.\')}</div><div class="recMeta">', '<div class="recLine"><b>Why:</b> ${esc(r.rationale||\'Strong observed recent evidence.\')}</div><div class="recLine"><b>Evidence source:</b> ${esc(r.account_name||r.handle||\'Observed public source\')} · ${esc(r.platform||\'Telegram/Web\')}</div><div class="recLine"><b>Recommended channel:</b> ${esc(recommendedChannel(r))}</div><div class="recMeta">')

# Improve navigation title for the two new sections without depending on the existing title map.
s=s.replace("document.querySelectorAll('.nav button').forEach", "document.querySelectorAll('.nav button').forEach")
s=s.replace("renderAll()}", "renderAll()}\n",1)

p.write_text(s)
print('dashboard source/channel v5 patched')
