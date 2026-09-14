from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Remove older v23 block if re-run.
s=re.sub(r'<script>\s*/\* WINTURBO_WORKFLOW_V23_START \*/.*?/\* WINTURBO_WORKFLOW_V23_END \*/\s*</script>','',s,flags=re.S)
s=re.sub(r'/\* WINTURBO_WORKFLOW_V23_CSS \*/.*?(?=\n/\*|\n</style>)','',s,flags=re.S)

# Remove v20 navigation runtime. v23 replaces it with an approval-aware navigation runtime.
s=re.sub(r'<script>\s*/\* WINTURBO_REDESIGN_V20_START \*/.*?/\* WINTURBO_REDESIGN_V20_END \*/\s*</script>','',s,flags=re.S)


def replace_section(src, sid, html):
    pat=rf'<section id="{re.escape(sid)}" class="section(?: on)?">.*?</section>'
    out,n=re.subn(pat,html,src,count=1,flags=re.S)
    if n!=1:
        raise SystemExit(f'section {sid} not found')
    return out

growth=r'''
<section id="growth" class="section">
  <div class="sectionHead"><div><h2>Growth Analytics</h2><div class="muted small">Live 7-day competitor posting and audience analytics from normalized scraped data.</div></div><span class="pill">LIVE VIEW</span></div>
  <div class="grid4">
    <div class="card"><div class="k">ACCOUNTS TRACKED</div><div class="v" id="growthAccounts">—</div><div class="subv">With analytics data</div></div>
    <div class="card"><div class="k">TOTAL FOLLOWERS</div><div class="v" id="growthFollowers">—</div><div class="subv">Current observed audience</div></div>
    <div class="card"><div class="k">POSTS TODAY</div><div class="v" id="growthPostsToday">—</div><div class="subv">Across selected accounts</div></div>
    <div class="card"><div class="k">POSTS / 7 DAYS</div><div class="v" id="growthPosts7d">—</div><div class="subv">Rolling weekly volume</div></div>
  </div>
  <div class="grid4">
    <div class="card"><div class="k">AVG POSTS / DAY</div><div class="v" id="growthAvgDaily">—</div><div class="subv">7-day average</div></div>
    <div class="card"><div class="k">ACTIVE POST DAYS</div><div class="v" id="growthActiveDays">—</div><div class="subv">Average active days / 7</div></div>
    <div class="card"><div class="k">AVG VIEWS</div><div class="v" id="growthAvgViews">—</div><div class="subv">Observed post views</div></div>
    <div class="card"><div class="k">TOP VIEWS</div><div class="v" id="growthTopViews">—</div><div class="subv">Best post in window</div></div>
  </div>
  <div class="tableWrap"><table><thead><tr><th>Rank</th><th>Account</th><th>Followers</th><th>Posts Today</th><th>Posts 7D</th><th>Avg / Day</th><th>Active Days</th><th>Common Time</th><th>Avg Views</th><th>Top Views</th><th>View Rate</th><th>Reactions</th></tr></thead><tbody id="growthBody"><tr><td colspan="12" class="muted">Loading analytics…</td></tr></tbody></table></div>
</section>
'''

posting=r'''
<section id="timing" class="section">
  <div class="sectionHead"><div><h2>Posting Intelligence</h2><div class="muted small">When competitors post, how much content appears in each hour, and which windows generate the strongest observed performance.</div></div><span class="pill">7-DAY INTELLIGENCE</span></div>
  <div class="grid4">
    <div class="card"><div class="k">BEST POSTING WINDOW</div><div class="v" id="timingBestHour">—</div><div class="subv">Ranked by observed performance</div></div>
    <div class="card"><div class="k">AVG VIEWS</div><div class="v" id="timingAvgViews">—</div><div class="subv">Best-performing hour</div></div>
    <div class="card"><div class="k">TOP VIEWS</div><div class="v" id="timingTopViews">—</div><div class="subv">Highest observed post</div></div>
    <div class="card"><div class="k">POSTS ANALYZED</div><div class="v" id="timingPostsAnalyzed">—</div><div class="subv">Across hourly buckets</div></div>
  </div>
  <div class="tableWrap"><table><thead><tr><th>Rank</th><th>Time</th><th>Posts</th><th>Competitors</th><th>Avg Views</th><th>Median Views</th><th>Top Views</th><th>Avg Reactions</th><th>Creative Score</th><th>Evidence</th></tr></thead><tbody id="timingBody"><tr><td colspan="10" class="muted">Loading posting intelligence…</td></tr></tbody></table></div>
</section>
'''

quality=r'''
<section id="quality" class="section">
  <div class="sectionHead"><div><h2>Data Quality & AI</h2><div class="muted small">Evidence-led WinTurbo content recommendations based on the strongest scraped posts, engagement signals, views, creative score and cross-source patterns.</div></div><span class="pill" id="qualityHealthBadge">CHECKING DATA</span></div>
  <div class="grid4">
    <div class="card"><div class="k">DATA STATUS</div><div class="v" id="qualityStatus">—</div><div class="subv">Normalized post evidence</div></div>
    <div class="card"><div class="k">SOURCE COVERAGE</div><div class="v" id="qualityCoverage">—</div><div class="subv">Active monitored links</div></div>
    <div class="card"><div class="k">FRESHNESS</div><div class="v" id="qualityFreshness">—</div><div class="subv">Latest successful scrape</div></div>
    <div class="card"><div class="k">AI CONFIDENCE</div><div class="v" id="qualityConfidence">—</div><div class="subv">Dominant recommendation confidence</div></div>
  </div>
  <div class="card" style="margin-top:14px"><div class="sectionHead"><div><h3>Monitored Data Sources</h3><div class="muted small">Latest fetch status per source.</div></div></div><div id="qualitySources"></div></div>
  <div class="sectionHead" style="margin-top:22px"><div><h2>Likely to Be Successful for WinTurbo</h2><div class="muted small">Up to 20 high-performing evidence cards. Use any card to create Telegram copy, Instagram copy, a ChatGPT text draft, or an image creative.</div></div><span class="pill greenPill">AI RECOMMENDATIONS</span></div>
  <div id="aiRecommendations" class="recommendationGrid"><div class="muted">Loading recommendation evidence…</div></div>
</section>
'''

approval=r'''
<section id="approval" class="section">
  <div class="sectionHead"><div><h2>Approval</h2><div class="muted small">Review AI-created posts, stories and creatives before publishing. Telegram can publish directly after approval; Instagram remains approval-ready until Meta publishing is connected.</div></div><span class="pill">CONTENT CONTROL</span></div>
  <div class="grid4">
    <div class="card"><div class="k">AWAITING APPROVAL</div><div class="v" id="approvalPending">—</div><div class="subv">Draft queue</div></div>
    <div class="card"><div class="k">APPROVED</div><div class="v" id="approvalApproved">—</div><div class="subv">Ready to publish</div></div>
    <div class="card"><div class="k">PUBLISHED</div><div class="v" id="approvalPublished">—</div><div class="subv">Successfully posted</div></div>
    <div class="card"><div class="k">FAILED</div><div class="v" id="approvalFailed">—</div><div class="subv">Needs attention</div></div>
  </div>
  <div id="approvalCards" class="approvalGrid"><div class="muted">Loading approval queue…</div></div>
</section>
'''

s=replace_section(s,'growth',growth)
s=replace_section(s,'timing',posting)
s=replace_section(s,'quality',quality)
if 'id="approval"' not in s:
    idx=s.rfind('</main>')
    if idx<0: raise SystemExit('main closing tag not found')
    s=s[:idx]+approval+'\n'+s[idx:]

css=r'''
/* WINTURBO_WORKFLOW_V23_CSS */
.recommendationGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.successRec{border:1px solid rgba(66,227,108,.44);background:linear-gradient(160deg,rgba(25,87,42,.72),rgba(10,35,18,.92));box-shadow:0 14px 36px rgba(0,0,0,.24);border-radius:16px;padding:16px}
.successRec .recTitle{font-size:17px;font-weight:850;line-height:1.25}.successRec .recScore{font-size:27px;font-weight:900;color:#dfffe6}.successRec .recEvidence{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.successRec .metric{background:rgba(5,18,10,.5);border:1px solid rgba(127,255,158,.14);border-radius:10px;padding:8px}.successRec .metric b{display:block;font-size:15px}.successRec .metric span{font-size:10px;color:#a8cbb1}.recActions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.recActions button{font-size:12px;padding:8px 10px}.greenPill{background:rgba(66,227,108,.15)!important;color:#b9ffc9!important;border-color:rgba(66,227,108,.35)!important}
.qualitySource{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}.qualitySource:last-child{border-bottom:0}.qualityState{text-transform:uppercase;font-size:10px;font-weight:850;color:#b7c6bd}
.approvalGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.approvalCard{border:1px solid var(--line);border-radius:16px;padding:16px;background:#0d140f}.approvalCard .copy{white-space:pre-wrap;max-height:220px;overflow:auto;background:#09100b;border:1px solid var(--line);border-radius:10px;padding:10px;margin:10px 0}.approvalMedia{width:100%;max-height:280px;object-fit:contain;border-radius:10px;background:#070b08}.statusDraft{color:#ffd27f}.statusApproved{color:#89d5ff}.statusPublished{color:#8cff9d}.statusFailed{color:#ff8b8b}
@media(max-width:900px){.recommendationGrid,.approvalGrid{grid-template-columns:1fr}.successRec .recEvidence{grid-template-columns:repeat(2,minmax(0,1fr))}}
'''
if '</style>' not in s: raise SystemExit('style closing tag not found')
s=s.replace('</style>',css+'\n</style>',1)

js=r'''
<script>
/* WINTURBO_WORKFLOW_V23_START */
(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const n=v=>new Intl.NumberFormat('en-IN').format(Number(v)||0);
  const f1=v=>Number(v||0).toFixed(1);
  const dt=v=>v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}):'—';
  const url=v=>{if(!v)return null;let x=String(v).trim();if(!/^https?:\/\//i.test(x))x='https://'+x.replace(/^\/+/, '');return x};
  const postUrl=r=>url(r.post_url)||((r.handle&&r.platform_post_id)?`https://t.me/${String(r.handle).replace(/^@/,'')}/${r.platform_post_id}`:null);
  const selected=()=> $('accountFilter')?.value||'all';
  const filterRows=rows=>selected()==='all'?rows:rows.filter(r=>r.handle===selected());
  const set=(id,v)=>{if($(id))$(id).textContent=v};
  let recommendationRows=[];
  let queueRows=[];
  let publishingAccounts=[];
  let hydrating=false;

  const IDS=['overview','growth','creative','telegramSources','otherSources','timing','quality','verification','contentIdeas','approval'];
  const TITLES={overview:'Executive Overview',growth:'Growth Analytics',creative:'Creative Explorer',telegramSources:'Telegram Sources',otherSources:'Instagram & Web',timing:'Posting Intelligence',quality:'Data Quality & AI',verification:'Verification',contentIdeas:'Content Ideas',approval:'Approval'};

  function ensureApprovalNav(){
    const nav=document.querySelector('.nav'); if(!nav)return;
    if(!nav.querySelector('[data-s="approval"]')){
      const b=document.createElement('button');b.dataset.s='approval';b.textContent='Approval';nav.appendChild(b);
    }
  }
  function show(id){
    if(!IDS.includes(id))id='overview';
    IDS.forEach(x=>{const sec=$(x);if(sec){const on=x===id;sec.classList.toggle('on',on);sec.style.setProperty('display',on?'block':'none','important');sec.setAttribute('aria-hidden',on?'false':'true')}});
    document.querySelectorAll('.nav button[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s===id));
    set('title',TITLES[id]||id);window.scrollTo({top:0,behavior:'smooth'});
  }

  function bindNavigation(){
    ensureApprovalNav();
    document.addEventListener('click',e=>{const b=e.target.closest?.('.nav button[data-s]');if(!b)return;e.preventDefault();show(b.dataset.s)},true);
  }

  function renderGrowth(rows){
    const gr=filterRows(rows);
    set('growthAccounts',gr.length);
    set('growthFollowers',n(gr.reduce((a,r)=>a+Number(r.followers_current||0),0)));
    set('growthPostsToday',n(gr.reduce((a,r)=>a+Number(r.posts_today||0),0)));
    set('growthPosts7d',n(gr.reduce((a,r)=>a+Number(r.posts_7d||0),0)));
    set('growthAvgDaily',gr.length?f1(gr.reduce((a,r)=>a+Number(r.avg_posts_per_day_7d||0),0)/gr.length):'—');
    set('growthActiveDays',gr.length?f1(gr.reduce((a,r)=>a+Number(r.active_post_days_7d||0),0)/gr.length):'—');
    const withViews=gr.filter(r=>r.avg_views_7d!=null);set('growthAvgViews',withViews.length?n(withViews.reduce((a,r)=>a+Number(r.avg_views_7d||0),0)/withViews.length):'—');
    set('growthTopViews',gr.length?n(Math.max(...gr.map(r=>Number(r.top_views_7d||0)))):'—');
    const body=$('growthBody');if(!body)return;
    body.innerHTML=gr.length?gr.map(r=>`<tr><td>#${r.audience_rank??'—'}</td><td><b>${esc(r.account_name||r.handle)}</b><div class="muted small">@${esc(r.handle||'')}</div></td><td>${n(r.followers_current)}</td><td>${n(r.posts_today)}</td><td>${n(r.posts_7d)}</td><td>${f1(r.avg_posts_per_day_7d)}</td><td>${n(r.active_post_days_7d)} / 7</td><td>${esc(r.most_common_post_time_ist||'—')}</td><td>${r.avg_views_7d==null?'—':n(Math.round(r.avg_views_7d))}</td><td>${r.top_views_7d==null?'—':n(r.top_views_7d)}</td><td>${r.avg_view_rate_7d_pct==null?'—':Number(r.avg_view_rate_7d_pct).toFixed(2)+'%'}</td><td>${Number(r.posts_with_reactions_7d||0)>0?Number(r.reaction_visibility_pct||0).toFixed(0)+'% visible':'Not publicly visible'}</td></tr>`).join(''):'<tr><td colspan="12" class="muted">No growth analytics for this selection.</td></tr>';
  }

  function renderCreative(rows){
    const cr=filterRows(rows).sort((a,b)=>Number(b.creative_score||0)-Number(a.creative_score||0));
    const body=$('creativeBody');if(!body)return;
    body.innerHTML=cr.length?cr.map((r,i)=>{const open=postUrl(r);return `<tr><td>#${i+1}</td><td><b>${esc(r.account_name||r.handle)}</b></td><td>${open?`<a class="openExternal" target="_blank" rel="noopener noreferrer" href="${esc(open)}">Open ↗</a>`:'—'}</td><td>${esc((r.hook||r.post_text||'Media post').slice(0,100))}</td><td>${esc(r.theme||'Unclassified')}</td><td>${esc(r.media_type||'—')}</td><td>${n(r.views)}</td><td>${r.observed_view_rate_pct==null?'—':Number(r.observed_view_rate_pct).toFixed(2)+'%'}</td><td class="score ${Number(r.creative_score)>=80?'high':'med'}">${r.creative_score==null?'—':Number(r.creative_score).toFixed(0)}</td><td>${dt(r.posted_at)}</td></tr>`}).join(''):'<tr><td colspan="10" class="muted">No scraped post data yet.</td></tr>';
  }

  function renderSources(rows){
    const active=filterRows(rows.filter(x=>x.is_active!==false));
    const tg=active.filter(x=>String(x.platform).toLowerCase()==='telegram');
    const oth=active.filter(x=>String(x.platform).toLowerCase()!=='telegram');
    set('tgSourceCount',tg.length);set('otherSourceCount',oth.length);
    set('tgLastUpdate',dt(tg.map(x=>x.last_scraped_at).filter(Boolean).sort().pop()));set('otherLastUpdate',dt(oth.map(x=>x.last_scraped_at).filter(Boolean).sort().pop()));
    if($('tgSourcesBody'))$('tgSourcesBody').innerHTML=tg.map(x=>{const u=url(x.source_url);return `<tr><td><b>${esc(x.source_name||x.handle)}</b></td><td>@${esc(x.handle||'—')}</td><td>${esc(x.scrape_status||'queued')}</td><td>${dt(x.last_scraped_at)}</td><td>—</td><td>${x.last_error?esc(x.last_error):'—'}</td><td>${u?`<a class="openExternal" target="_blank" rel="noopener noreferrer" href="${esc(u)}">Open ↗</a>`:'—'}</td></tr>`}).join('')||'<tr><td colspan="7" class="muted">No Telegram sources.</td></tr>';
    if($('otherSourcesBody'))$('otherSourcesBody').innerHTML=oth.map(x=>{const u=url(x.source_url);return `<tr><td><b>${esc(x.source_name||x.source_url)}</b></td><td>${esc(x.platform||'Web')}</td><td>${esc(x.scrape_status||'queued')}</td><td>${dt(x.last_scraped_at)}</td><td>—</td><td>${x.last_error?esc(x.last_error):'—'}</td><td>${u?`<a class="openExternal" target="_blank" rel="noopener noreferrer" href="${esc(u)}">Open ↗</a>`:'—'}</td></tr>`}).join('')||'<tr><td colspan="7" class="muted">No Instagram/Web sources.</td></tr>';
    return active;
  }

  function renderTiming(rows){
    const ti=[...rows].sort((a,b)=>Number(a.performance_rank||999)-Number(b.performance_rank||999));
    const best=ti[0];set('timingBestHour',best?.post_hour_label||'—');set('timingAvgViews',best?.avg_views==null?'—':n(Math.round(best.avg_views)));set('timingTopViews',best?.top_views==null?'—':n(best.top_views));set('timingPostsAnalyzed',n(ti.reduce((a,r)=>a+Number(r.posts_count||0),0)));
    const body=$('timingBody');if(!body)return;
    body.innerHTML=ti.length?ti.map(r=>{let detail=[];try{detail=Array.isArray(r.posts_detail)?r.posts_detail:[]}catch{};const links=detail.slice(0,3).map(d=>{const u=postUrl(d);return u?`<a class="openExternal" target="_blank" rel="noopener noreferrer" href="${esc(u)}">Post ↗</a>`:''}).filter(Boolean).join(' · ');return `<tr><td>#${r.performance_rank??'—'}</td><td><b>${esc(r.post_hour_label||r.post_hour_ist)}</b></td><td>${n(r.posts_count)}</td><td>${n(r.competitors_posting)}</td><td>${r.avg_views==null?'—':n(Math.round(r.avg_views))}</td><td>${r.median_views==null?'—':n(Math.round(r.median_views))}</td><td>${r.top_views==null?'—':n(r.top_views)}</td><td>${r.avg_reactions==null?'Not visible':f1(r.avg_reactions)}</td><td>${r.avg_creative_score==null?'—':f1(r.avg_creative_score)}</td><td>${links||'—'}</td></tr>`}).join(''):'<tr><td colspan="10" class="muted">No posting intelligence available yet.</td></tr>';
  }

  function recommendationPrompt(r){return `${r.theme||'High-performing content pattern'}\n\nSource evidence: ${r.account_name||r.handle||'competitor'}; ${n(r.views||0)} views; creative score ${r.creative_score==null?'n/a':Number(r.creative_score).toFixed(0)}; success likelihood ${Number(r.success_likelihood_score||0).toFixed(0)}%.\n\nDirection: ${r.hook||r.post_text||r.rationale||'Create an original WinTurbo version inspired by the observed pattern.'}`}
  function renderRecommendations(rows){
    recommendationRows=filterRows(rows).filter(r=>Number(r.success_likelihood_score||0)>0).sort((a,b)=>Number(b.success_likelihood_score)-Number(a.success_likelihood_score)).slice(0,20);
    const host=$('aiRecommendations');if(!host)return;
    host.innerHTML=recommendationRows.length?recommendationRows.map((r,i)=>{const score=Number(r.success_likelihood_score||0),u=postUrl(r);return `<article class="successRec"><div style="display:flex;justify-content:space-between;gap:12px"><div><div class="recTitle">#${i+1} ${esc(r.theme||'High-performing pattern')}</div><div class="muted small">${esc(r.account_name||r.handle||'Observed source')} · ${esc(r.media_type||'content')} · ${dt(r.posted_at)}</div></div><div class="recScore">${score.toFixed(0)}%</div></div><div class="recEvidence"><div class="metric"><b>${n(r.views)}</b><span>Views</span></div><div class="metric"><b>${r.reactions_count==null?'N/A':n(r.reactions_count)}</b><span>Reactions</span></div><div class="metric"><b>${r.creative_score==null?'N/A':Number(r.creative_score).toFixed(0)}</b><span>Creative Score</span></div><div class="metric"><b>${n(r.pattern_sample_size||0)}</b><span>Pattern Sample</span></div></div><div><b>Why it may work:</b> ${esc(r.rationale||'Strong observed performance relative to the available evidence.')}</div><div class="muted small" style="margin-top:7px"><b>Hook:</b> ${esc((r.hook||r.post_text||'').slice(0,220))}</div>${u?`<div style="margin-top:8px"><a class="openExternal" target="_blank" rel="noopener noreferrer" href="${esc(u)}">Open source evidence ↗</a></div>`:''}<div class="recActions"><button class="primary recCreate" data-i="${i}" data-platform="telegram" data-format="image">Create Telegram</button><button class="ghost recCreate" data-i="${i}" data-platform="instagram" data-format="image">Create Instagram</button><button class="ghost recCreate" data-i="${i}" data-platform="telegram" data-format="text">Write with ChatGPT</button><button class="ghost recCreate" data-i="${i}" data-platform="instagram" data-format="image">Create Image</button></div></article>`}).join(''):'<div class="muted">No recommendation evidence is available yet.</div>';
  }

  function renderQuality(active,success){
    const last=active.map(x=>x.last_scraped_at).filter(Boolean).sort().pop();const age=last?(Date.now()-new Date(last).getTime())/36e5:null;
    set('qualityStatus',success.length?'Data available':'Awaiting data');set('qualityCoverage',`${active.length} active links`);set('qualityFreshness',age==null?'No scrape yet':age<6?'Fresh':age<24?'Recent':Math.round(age)+'h old');
    const cc={};success.forEach(x=>{if(x.confidence)cc[x.confidence]=(cc[x.confidence]||0)+1});set('qualityConfidence',Object.entries(cc).sort((a,b)=>b[1]-a[1])[0]?.[0]||'Waiting');
    const badge=$('qualityHealthBadge');if(badge){badge.textContent=age!=null&&age<24?'DATA CURRENT':'REFRESH NEEDED';badge.className='pill '+(age!=null&&age<24?'greenPill':'orange')}
    if($('qualitySources'))$('qualitySources').innerHTML=active.length?active.map(x=>`<div class="qualitySource"><div><b>${esc(x.source_name||x.handle||x.source_url)}</b><div class="muted small">${esc(x.platform||'Source')} · ${x.last_scraped_at?'Updated '+dt(x.last_scraped_at):'Not fetched yet'}${x.last_error?' · '+esc(x.last_error):''}</div></div><span class="qualityState">${esc(x.scrape_status||'queued')}</span></div>`).join(''):'<div class="muted">No active monitored links.</div>';
  }

  async function createFromRecommendation(i,platform,format){
    const r=recommendationRows[i];if(!r)return;
    show('contentIdeas');
    if($('ideaInput'))$('ideaInput').value=recommendationPrompt(r);
    if($('ideaPlatform'))$('ideaPlatform').value=platform;
    if($('ideaFormat'))$('ideaFormat').value=format;
    if($('ideaType'))$('ideaType').value='idea';
    if($('ideaTone'))$('ideaTone').value='Premium & confident';
    setTimeout(()=>$('generateIdeaContent')?.click(),120);
  }

  async function sendCurrentToApproval(platform){
    const text=$('ideaDraft')?.value?.trim();if(!text){alert('Generate content first.');return}
    const fmt=$('ideaFormat')?.value||'text';const media=$('ideaMediaUrl')?.value?.trim()||null;
    const account=publishingAccounts.find(a=>a.platform===platform&&a.connection_status==='connected')||publishingAccounts.find(a=>a.platform===platform)||null;
    const {data:{user}}=await sb.auth.getUser();
    const payload={platform,publishing_account_id:account?.id||null,content_text:text,status:'draft',created_by:user?.id||null,media_url:media,media_type:media?(fmt==='video'?'video':'photo'):null};
    const {error}=await sb.from('publishing_queue').insert(payload);if(error)throw error;
    if($('ideaPublishStatus'))$('ideaPublishStatus').textContent=`Sent to Approval ✓ · ${platform}`;
    await hydrate();show('approval');
  }

  function bindApprovalIntercept(){
    const tg=$('publishIdeaTelegram');if(tg){tg.disabled=false;tg.textContent='Send Telegram to Approval';tg.onclick=async()=>{try{await sendCurrentToApproval('telegram')}catch(e){alert(e?.message||e)}}}
    const ig=$('publishIdeaInstagram');if(ig){ig.disabled=false;ig.textContent='Send Instagram to Approval';ig.onclick=async()=>{try{await sendCurrentToApproval('instagram')}catch(e){alert(e?.message||e)}}}
  }

  function renderApprovals(rows){
    queueRows=rows||[];set('approvalPending',queueRows.filter(x=>x.status==='draft').length);set('approvalApproved',queueRows.filter(x=>x.status==='approved').length);set('approvalPublished',queueRows.filter(x=>x.status==='published').length);set('approvalFailed',queueRows.filter(x=>x.status==='failed').length);
    const host=$('approvalCards');if(!host)return;
    const ordered=[...queueRows].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    host.innerHTML=ordered.length?ordered.map((q,i)=>{const media=q.media_url?(q.media_type==='video'?`<video class="approvalMedia" controls playsinline src="${esc(url(q.media_url))}"></video>`:`<img class="approvalMedia" alt="Queued creative" src="${esc(url(q.media_url))}">`):'';const cls=q.status==='draft'?'statusDraft':q.status==='approved'?'statusApproved':q.status==='published'?'statusPublished':q.status==='failed'?'statusFailed':'';return `<article class="approvalCard"><div style="display:flex;justify-content:space-between;gap:10px"><div><b>${esc(String(q.platform||'').toUpperCase())}</b><div class="muted small">Created ${dt(q.created_at)}</div></div><b class="${cls}">${esc(q.status||'draft')}</b></div>${media}<div class="copy">${esc(q.content_text||'')}</div>${q.published_url?`<a class="openExternal" target="_blank" rel="noopener noreferrer" href="${esc(url(q.published_url))}">Open published post ↗</a>`:''}<div class="recActions">${q.status==='draft'?`<button class="primary approveQueue" data-id="${esc(q.id)}" data-platform="${esc(q.platform)}">Approve${q.platform==='telegram'?' & Publish':''}</button><button class="ghost rejectQueue" data-id="${esc(q.id)}">Reject</button>`:''}${q.status==='approved'&&q.platform==='telegram'?`<button class="primary publishQueue" data-id="${esc(q.id)}">Publish Telegram</button>`:''}${q.status==='approved'&&q.platform==='instagram'?`<button class="ghost" disabled>Connect Meta to Publish</button>`:''}</div>${q.error_message?`<div class="small statusFailed" style="margin-top:8px">${esc(q.error_message)}</div>`:''}</article>`}).join(''):'<div class="muted">No generated content is waiting for approval.</div>';
  }

  async function publishTelegramQueue(id){const {data,error}=await sb.functions.invoke('publish-telegram',{body:{action:'publish',queue_id:id}});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'Telegram publish failed');return data}
  async function approveQueue(id,platform){
    const account=publishingAccounts.find(a=>a.platform===platform&&a.connection_status==='connected')||publishingAccounts.find(a=>a.platform===platform)||null;
    const patch={status:'approved'};if(account?.id)patch.publishing_account_id=account.id;
    const {error}=await sb.from('publishing_queue').update(patch).eq('id',id);if(error)throw error;
    if(platform==='telegram'){if(!account||account.connection_status!=='connected')throw new Error('Telegram publishing account is not connected.');await publishTelegramQueue(id)}
    await hydrate();
  }
  async function rejectQueue(id){const {error}=await sb.from('publishing_queue').update({status:'cancelled'}).eq('id',id);if(error)throw error;await hydrate()}

  async function hydrate(){
    if(hydrating||typeof sb==='undefined')return;hydrating=true;
    try{
      const [a,g,c,sr,si,ti,pq,pa]=await Promise.all([
        sb.from('accounts').select('account_name,handle,followers_current,last_seen_at').order('followers_current',{ascending:false}),
        sb.from('competitor_growth_analytics_v3').select('*').order('audience_rank'),
        sb.from('creative_leaderboard').select('*').order('posted_at',{ascending:false}).limit(500),
        sb.from('monitored_sources').select('*').order('created_at',{ascending:false}),
        sb.from('content_success_intelligence').select('*').order('success_likelihood_score',{ascending:false}).limit(500),
        sb.from('posting_intelligence').select('*').order('performance_rank'),
        sb.from('publishing_queue').select('*').order('created_at',{ascending:false}).limit(100),
        sb.from('publishing_accounts').select('*').eq('is_active',true)
      ]);
      const accounts=a.data||[],growth=g.data||[],creative=c.data||[],sources=sr.data||[],success=si.data||[],timing=ti.data||[];publishingAccounts=pa.data||[];
      const filter=$('accountFilter');if(filter){const old=filter.value||'all';filter.innerHTML='<option value="all">All monitored accounts</option>'+accounts.map(x=>`<option value="${esc(x.handle)}">${esc(x.account_name||x.handle)}</option>`).join('');filter.value=[...filter.options].some(o=>o.value===old)?old:'all'}
      renderGrowth(growth);renderCreative(creative);const active=renderSources(sources);renderTiming(timing);renderQuality(active,success);renderRecommendations(success);renderApprovals(pq.data||[]);
      set('accounts',filterRows(accounts).length);set('members',n(filterRows(accounts).reduce((z,x)=>z+Number(x.followers_current||0),0)));set('overviewPosts',filterRows(creative).length);set('posts',filterRows(creative).length);set('views',n(filterRows(creative).reduce((z,x)=>z+Number(x.views||0),0)));set('postAccounts',new Set(filterRows(creative).map(x=>x.handle).filter(Boolean)).size);set('activeLinks',active.length);
      const last=active.map(x=>x.last_scraped_at).filter(Boolean).sort().pop();set('lastDataUpdate',last?dt(last):'Waiting for scrape');if($('lastDataUpdateSub'))$('lastDataUpdateSub').textContent=last?'Latest successful source scrape':'No successful scrape yet';
      bindApprovalIntercept();
    }catch(e){console.error('WinTurbo workflow v23',e);if($('aiRecommendations'))$('aiRecommendations').innerHTML=`<div class="successRec">Data load failed: ${esc(e?.message||e)}</div>`}
    finally{hydrating=false}
  }

  document.addEventListener('click',async e=>{
    const rec=e.target.closest?.('.recCreate');if(rec){e.preventDefault();return createFromRecommendation(Number(rec.dataset.i),rec.dataset.platform,rec.dataset.format)}
    const ap=e.target.closest?.('.approveQueue');if(ap){e.preventDefault();ap.disabled=true;try{await approveQueue(ap.dataset.id,ap.dataset.platform)}catch(err){alert(err?.message||err)}finally{ap.disabled=false}return}
    const rej=e.target.closest?.('.rejectQueue');if(rej){e.preventDefault();if(confirm('Reject this queued content?')){try{await rejectQueue(rej.dataset.id)}catch(err){alert(err?.message||err)}}return}
    const pub=e.target.closest?.('.publishQueue');if(pub){e.preventDefault();pub.disabled=true;try{await publishTelegramQueue(pub.dataset.id);await hydrate()}catch(err){alert(err?.message||err)}finally{pub.disabled=false}}
  });

  function boot(){bindNavigation();const selected=document.querySelector('.nav button.on[data-s]');show(selected&&IDS.includes(selected.dataset.s)?selected.dataset.s:'overview');$('refresh')?.addEventListener('click',()=>setTimeout(hydrate,50));$('accountFilter')?.addEventListener('change',hydrate);hydrate();setTimeout(hydrate,900);setTimeout(()=>{bindApprovalIntercept();hydrate()},2200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.WinTurboHydrate=hydrate;
})();
/* WINTURBO_WORKFLOW_V23_END */
</script>
'''
if '</body>' not in s: raise SystemExit('body closing tag not found')
s=s.replace('</body>',js+'\n</body>',1)
p.write_text(s,encoding='utf-8')
print('Installed v23 live analytics, working external links, AI recommendation actions and approval workflow.')
