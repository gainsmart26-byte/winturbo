from pathlib import Path

p = Path('dashboard.html')
s = p.read_text()

# Styles for green likely-success cards.
s = s.replace(
    ".recGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}",
    ".recGrid,.successGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.successCard{padding:16px;border:1px solid #2fd45b;border-radius:14px;background:linear-gradient(180deg,rgba(31,89,45,.42),rgba(12,30,17,.72));box-shadow:0 0 0 1px rgba(66,227,108,.08) inset}.successHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.successBadge{display:inline-flex;background:#42e36c;color:#061007;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:950;letter-spacing:.03em}.successScore{font-size:28px;font-weight:950;color:#7df39a}"
)
s = s.replace(
    ".grid2,.recGrid{grid-template-columns:1fr}",
    ".grid2,.recGrid,.successGrid{grid-template-columns:1fr}"
)

# Growth tab shows 30-minute dashboard refresh.
s = s.replace(
    '<div class="card"><div class="k">Tracking</div><div class="v" style="font-size:19px"><span class="pill">HOURLY</span></div></div>',
    '<div class="card"><div class="k">Dashboard Refresh</div><div class="v" style="font-size:19px"><span class="pill">EVERY 30 MIN</span></div><div id="growthUpdated" class="subv">Waiting for refresh</div></div>'
)

# Data-quality header: 7-day backfill replaces reaction-handling KPI (reaction handling remains in rules/data logic).
s = s.replace(
    '<div class="card"><div class="k">Reaction Handling</div><div class="v" style="font-size:19px">Nullable</div></div>',
    '<div class="card"><div class="k">Backfill Window</div><div class="v" style="font-size:19px">Last 7 Days</div></div>'
)

marker = '<div class="card" style="margin-bottom:13px"><div class="sectionHead"><div><h3>Monitored Data Sources</h3>'
intelligence = '''<div class="card" style="margin-bottom:13px"><div class="sectionHead"><div><h3>Likely to Be Successful — AI Intelligence</h3><div class="muted small">Evidence-based prediction from the last 7 days. Green cards indicate stronger observed patterns, not guaranteed future performance.</div></div><span class="successBadge">SUCCESS INTELLIGENCE</span></div><div id="successIntelligence" class="successGrid"><div class="muted">Loading success intelligence…</div></div></div>'''
if 'id="successIntelligence"' not in s:
    s = s.replace(marker, intelligence + marker)

s = s.replace(
    'Add a public link once; the hourly scraper will pick up active sources automatically.',
    'Every active/new link is configured for up to 7 days of available public-history backfill, then ongoing accumulation.'
)
s = s.replace(
    'Paste a public link to start monitoring.',
    'Paste a public link. Up to the last 7 days will be backfilled where available.'
)

# Add success intelligence state + query.
s = s.replace(
    'let audienceChart,timingChart,allAccounts=[],allGrowth=[],allCreative=[],allSources=[];',
    'let audienceChart,timingChart,allAccounts=[],allGrowth=[],allCreative=[],allSources=[],allSuccess=[];'
)
s = s.replace(
    'Promise.all([loadAccounts(),loadGrowth(),loadCreative(),loadSources()])',
    'Promise.all([loadAccounts(),loadGrowth(),loadCreative(),loadSources(),loadSuccess()])'
)
s = s.replace(
    "async function loadGrowth(){const{data}=await sb.from('competitor_growth_analytics').select('*').order('audience_rank');allGrowth=data||[]}",
    "async function loadGrowth(){const{data}=await sb.from('competitor_growth_analytics').select('*').order('audience_rank');allGrowth=data||[];if($('growthUpdated'))$('growthUpdated').textContent='Updated '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})+' IST'}"
)
s = s.replace(
    "async function loadSources(){const{data}=await sb.from('monitored_sources').select('*').order('created_at',{ascending:false});allSources=data||[];renderSources()}",
    "async function loadSources(){const{data}=await sb.from('monitored_sources').select('*').order('created_at',{ascending:false});allSources=data||[];renderSources()}\nasync function loadSuccess(){const{data}=await sb.from('content_success_intelligence').select('*').order('success_likelihood_score',{ascending:false}).limit(100);allSuccess=data||[]}"
)
s = s.replace(
    'function renderAll(){renderOverview();renderGrowth();renderCreative();renderTiming();renderRecommendations()}',
    'function renderAll(){renderOverview();renderGrowth();renderCreative();renderTiming();renderRecommendations();renderSuccess()}'
)

success_fn = r'''function renderSuccess(){if(!$('successIntelligence'))return;let rows=filterByHandle(allSuccess);const likely=rows.filter(r=>Number(r.success_likelihood_score)>=75);rows=(likely.length?likely:rows.slice(0,4)).slice(0,6);if(!rows.length){$('successIntelligence').innerHTML='<div class="muted">No last-7-day intelligence is available yet for this selection.</div>';return}$('successIntelligence').innerHTML=rows.map(r=>`<div class="successCard"><div class="successHead"><div><span class="successBadge">${Number(r.success_likelihood_score)>=75?'LIKELY TO BE SUCCESSFUL':'PROMISING PATTERN'}</span><h3 style="margin:10px 0 2px">${esc(r.theme||'Unclassified')}</h3><div class="muted small">${esc(r.account_name)} · ${esc(r.media_type||'text')} · ${dateFmt(r.posted_at)}</div></div><div class="successScore">${Number(r.success_likelihood_score).toFixed(0)}</div></div><div class="recLine"><b>Content signal:</b> ${esc((r.hook||r.post_text||'Media-led content').slice(0,140))}</div><div class="recLine"><b>Why:</b> ${esc(r.rationale||'Strong observed recent evidence.')}</div><div class="recMeta"><span class="pill">${esc(r.confidence)} confidence</span><span class="pill blue">${fmt.format(r.views||0)} views</span><span class="pill orange">${r.observed_view_rate_pct==null?'View rate n/a':Number(r.observed_view_rate_pct).toFixed(2)+'% view rate'}</span></div><div class="small muted">Pattern evidence: ${r.pattern_sample_size||0} posts · ${r.pattern_competitors||0} competitor(s). Directional intelligence, not a guarantee.</div><div class="recActions"><a class="mini" target="_blank" rel="noopener" href="${esc(r.post_url)}">View Source Post</a></div></div>`).join('')}'''
if 'function renderSuccess()' not in s:
    s = s.replace('function renderSources(){', success_fn + '\nfunction renderSources(){')

# Add 7-day status in source rows and update source confirmation.
s = s.replace(
    '${esc(s.platform)} · ${esc(s.source_url)}</div></div><div><span class="pill',
    '${esc(s.platform)} · ${esc(s.source_url)}</div><div class="small" style="color:#8df2a3">7-day backfill enabled where public history is available</div></div><div><span class="pill'
)
s = s.replace(
    'Added. The hourly scraper will begin accumulating data from this source.',
    'Added. The hourly scraper will backfill up to the last 7 days where available, then keep accumulating.'
)

# Dashboard Growth data refreshes every 30 minutes. Underlying scraping remains hourly due scheduler limit.
refresh = "async function refreshGrowth(){await Promise.all([loadAccounts(),loadGrowth()]);renderGrowth();renderOverview()}setInterval(refreshGrowth,30*60*1000);"
if 'setInterval(refreshGrowth,30*60*1000)' not in s:
    s = s.replace("sb.auth.getSession().then(({data})=>{if(data.session)showApp()});", refresh + "\nsb.auth.getSession().then(({data})=>{if(data.session)showApp()});")

p.write_text(s)
print('dashboard.html patched')
