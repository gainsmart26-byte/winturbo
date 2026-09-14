from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Replace Executive Overview with a live-data layout.
overview=r'''
<section id="overview" class="section on">
  <div class="sectionHead"><div><h2>Executive Summary</h2><div class="muted small">Live competitor audience, source coverage, content and AI intelligence from the current normalized dataset.</div></div><span class="pill">LIVE INTELLIGENCE</span></div>
  <div class="grid4">
    <div class="card"><div class="k">MONITORED ACCOUNTS</div><div id="accounts" class="v">—</div><div class="subv">Accounts with current data</div></div>
    <div class="card"><div class="k">OBSERVED MEMBERS</div><div id="members" class="v">—</div><div class="subv">Current combined audience</div></div>
    <div class="card"><div class="k">POSTS ANALYZED</div><div id="overviewPosts" class="v">—</div><div class="subv">Normalized creative records</div></div>
    <div class="card"><div class="k">TOP CREATIVE SCORE</div><div id="overviewTopScore" class="v">—</div><div id="overviewTopName" class="subv">—</div></div>
  </div>
  <div class="grid4">
    <div class="card"><div class="k">TELEGRAM LINKS</div><div id="overviewTelegramLinks" class="v">—</div><div class="subv">Active monitored channels</div></div>
    <div class="card"><div class="k">INSTAGRAM LINKS</div><div id="overviewInstagramLinks" class="v">—</div><div class="subv">Active monitored accounts</div></div>
    <div class="card"><div class="k">WEB LINKS</div><div id="overviewWebLinks" class="v">—</div><div class="subv">Active monitored sites</div></div>
    <div class="card"><div class="k">TOTAL ACTIVE LINKS</div><div id="overviewTotalLinks" class="v">—</div><div id="overviewLinkBreakdown" class="subv">—</div></div>
  </div>
  <div class="grid4">
    <div class="card"><div class="k">POSTS · LAST 24H</div><div id="posts24h" class="v">—</div><div id="posts24hSub" class="subv">—</div></div>
    <div class="card"><div class="k">LAST DATA UPDATE</div><div id="lastDataUpdate" class="v" style="font-size:18px">—</div><div id="lastDataUpdateSub" class="subv">Latest source scrape</div></div>
    <div class="card"><div class="k">TOP CONTENT TOPIC · 7D</div><div id="topTopic" class="v" style="font-size:18px">—</div><div id="topTopicSub" class="subv">—</div></div>
    <div class="card"><div class="k">TOP TRENDING POST</div><div id="topTrendingViews" class="v">—</div><div id="topTrendingName" class="subv">—</div></div>
  </div>
  <div class="grid2">
    <div class="card"><div class="sectionHead"><div><h3>Audience Ranking</h3><div class="muted small">Ranked by current observed members/followers.</div></div><span class="pill">LIVE</span></div><div id="audienceRankingList"><div class="muted">Loading audience ranking…</div></div></div>
    <div class="card"><div class="sectionHead"><div><h3>What AI Learned</h3><div class="muted small">Evidence-led findings from the strongest current content patterns.</div></div><span class="pill greenPill">AI</span></div><div id="aiOverview"><div class="muted">Loading AI learnings…</div></div></div>
  </div>
  <div class="grid2">
    <div class="card"><div class="sectionHead"><div><h3>Activated Links by Channel</h3><div class="muted small">All currently active monitored links, grouped by channel type.</div></div><span class="pill">SOURCES</span></div><div id="overviewSources"><div class="muted">Loading sources…</div></div></div>
    <div class="card"><div class="sectionHead"><div><h3>Trending Posts by Link</h3><div class="muted small">Highest-view recent post from each monitored link/account.</div></div><span class="pill orange">7 DAYS</span></div><div id="overviewTrending"><div class="muted">Loading trending posts…</div></div></div>
  </div>
  <div class="card"><div class="sectionHead"><div><h3>Content Topics Analytics</h3><div class="muted small">7-day topic volume, views and creative performance.</div></div><span class="pill blue">CONTENT</span></div><div class="tableWrap"><table><thead><tr><th>Rank</th><th>Topic</th><th>Posts</th><th>Total Views</th><th>Avg Views</th><th>Top Views</th><th>Avg Creative Score</th><th>Share</th></tr></thead><tbody id="topicBody"><tr><td colspan="8" class="muted">Loading topic analytics…</td></tr></tbody></table></div></div>
</section>
'''
pat=r'<section id="overview" class="section(?: on)?">.*?</section>\s*(?=<section id="growth")'
s,n=re.subn(pat,overview+'\n',s,count=1,flags=re.S)
if n!=1: raise SystemExit('overview section not found')

css=r'''
/* WINTURBO_EXECUTIVE_V26_CSS */
.audienceRow,.overviewSourceRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.audienceRow:last-child,.overviewSourceRow:last-child{border-bottom:0}.audienceRank{width:30px;font-weight:900;color:var(--green)}
.audienceMeta{flex:1}.audienceValue{text-align:right;font-weight:850}.overviewSourceGroup{margin-bottom:14px}.overviewSourceGroup h4{margin:0 0 7px;color:#b9ffc9}.trendItem{padding:11px 0;border-bottom:1px solid var(--line)}.trendItem:last-child{border-bottom:0}.trendTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.trendText{margin-top:6px}.aiLearn{padding:11px 0;border-bottom:1px solid var(--line)}.aiLearn:last-child{border-bottom:0}
'''
s=s.replace('</style>',css+'\n</style>',1)

js=r'''
<script>
/* WINTURBO_EXECUTIVE_V26_START */
(function(){
 const $=id=>document.getElementById(id); const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const fmt=v=>new Intl.NumberFormat('en-IN').format(Number(v)||0); const dt=v=>v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}):'—';
 const set=(id,v)=>{if($(id))$(id).textContent=v}; const sel=()=> $('accountFilter')?.value||'all'; const match=r=>sel()==='all'||r.handle===sel();
 const safeUrl=v=>{if(!v)return null;let x=String(v).trim();if(!/^https?:\/\//i.test(x))x='https://'+x.replace(/^\/+/, '');return x};
 async function renderExecutive(){
   if(typeof sb==='undefined'||!$('overview'))return;
   const [g,c,sources,success]=await Promise.all([
     sb.from('competitor_growth_analytics_v3').select('*').order('audience_rank'),
     sb.from('creative_leaderboard').select('*').order('posted_at',{ascending:false}).limit(1000),
     sb.from('monitored_sources').select('*').eq('is_active',true).order('created_at',{ascending:false}),
     sb.from('content_success_intelligence').select('*').order('success_likelihood_score',{ascending:false}).limit(200)
   ]);
   const gr=(g.data||[]).filter(match), cr=(c.data||[]).filter(match), src=(sources.data||[]).filter(match), suc=(success.data||[]).filter(match);
   const cut7=Date.now()-7*864e5,cut24=Date.now()-864e5; const recent=cr.filter(r=>r.posted_at&&new Date(r.posted_at).getTime()>=cut7); const recent24=cr.filter(r=>r.posted_at&&new Date(r.posted_at).getTime()>=cut24);
   set('accounts',gr.length); set('members',fmt(gr.reduce((a,r)=>a+Number(r.followers_current||0),0))); set('overviewPosts',cr.length);
   const scored=cr.filter(r=>r.creative_score!=null).sort((a,b)=>Number(b.creative_score)-Number(a.creative_score)); const top=scored[0]; set('overviewTopScore',top?Number(top.creative_score).toFixed(0):'—'); set('overviewTopName',top?.account_name||'No scored posts');
   const countPlatform=p=>src.filter(x=>String(x.platform||'').toLowerCase()===p).length; const tg=countPlatform('telegram'),ig=countPlatform('instagram'),webc=src.length-tg-ig;
   set('overviewTelegramLinks',tg);set('overviewInstagramLinks',ig);set('overviewWebLinks',webc);set('overviewTotalLinks',src.length);set('overviewLinkBreakdown',`Telegram ${tg} · Instagram ${ig} · Web ${webc}`);
   set('posts24h',recent24.length);set('posts24hSub',recent24.length?`${new Set(recent24.map(x=>x.handle).filter(Boolean)).size} channel(s) contributed`:'No posts observed in last 24 hours');
   const last=src.map(x=>x.last_scraped_at).filter(Boolean).sort().pop();set('lastDataUpdate',last?dt(last):'Waiting for scrape');
   const topics={};recent.forEach(r=>{const k=r.theme||'Unclassified',x=topics[k]||(topics[k]={topic:k,posts:0,views:0,top:0,scores:[]});x.posts++;x.views+=Number(r.views||0);x.top=Math.max(x.top,Number(r.views||0));if(r.creative_score!=null)x.scores.push(Number(r.creative_score))});
   const tr=Object.values(topics).map(x=>({...x,avg:x.posts?x.views/x.posts:0,score:x.scores.length?x.scores.reduce((a,b)=>a+b,0)/x.scores.length:null})).sort((a,b)=>b.posts-a.posts||b.views-a.views); const tt=tr[0];set('topTopic',tt?.topic||'No topic data');set('topTopicSub',tt?`${fmt(tt.posts)} posts · ${fmt(tt.views)} views`:'—');
   const trending=[...recent].sort((a,b)=>Number(b.views||0)-Number(a.views||0));set('topTrendingViews',trending[0]?fmt(trending[0].views):'—');set('topTrendingName',trending[0]?.account_name||'No recent post');
   const ar=$('audienceRankingList');if(ar)ar.innerHTML=gr.length?gr.slice(0,12).map(r=>`<div class="audienceRow"><div class="audienceRank">#${esc(r.audience_rank??'—')}</div><div class="audienceMeta"><b>${esc(r.account_name||r.handle)}</b><div class="muted small">@${esc(r.handle||'')} · ${fmt(r.posts_7d||0)} posts / 7d${r.avg_views_7d!=null?' · '+fmt(Math.round(r.avg_views_7d))+' avg views':''}</div></div><div class="audienceValue">${fmt(r.followers_current)}</div></div>`).join(''):'<div class="muted">No audience ranking data.</div>';
   const os=$('overviewSources');if(os){const groups={Telegram:src.filter(x=>String(x.platform).toLowerCase()==='telegram'),Instagram:src.filter(x=>String(x.platform).toLowerCase()==='instagram'),Web:src.filter(x=>!['telegram','instagram'].includes(String(x.platform).toLowerCase()))};os.innerHTML=Object.entries(groups).map(([name,rows])=>`<div class="overviewSourceGroup"><h4>${name} · ${rows.length}</h4>${rows.length?rows.map(x=>{const u=safeUrl(x.source_url);return `<div class="overviewSourceRow"><div><b>${esc(x.source_name||x.handle||x.source_url)}</b><div class="muted small">${esc(x.handle||'')} · ${esc(x.scrape_status||'queued')} · ${x.last_scraped_at?dt(x.last_scraped_at):'not fetched'}</div></div>${u?`<a target="_blank" rel="noopener noreferrer" href="${esc(u)}">Open ↗</a>`:''}</div>`}).join(''):'<div class="muted small">No active links</div>'}</div>`).join('')}
   const by={};recent.forEach(r=>{const k=r.handle||r.account_name||r.post_url||String(r.id);if(!by[k]||Number(r.views||0)>Number(by[k].views||0))by[k]=r});const per=Object.values(by).sort((a,b)=>Number(b.views||0)-Number(a.views||0)).slice(0,12);const ot=$('overviewTrending');if(ot)ot.innerHTML=per.length?per.map((r,i)=>`<div class="trendItem"><div class="trendTop"><div><b>#${i+1} ${esc(r.account_name||r.handle||'Source')}</b><div class="muted small">@${esc(r.handle||'')} · ${dt(r.posted_at)}</div></div><span class="pill blue">${fmt(r.views)} views</span></div><div class="trendText">${esc((r.hook||r.post_text||'Media post').slice(0,160))}</div>${r.post_url?`<div style="margin-top:6px"><a target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(r.post_url))}">Open post ↗</a></div>`:''}</div>`).join(''):'<div class="muted">No recent posts available.</div>';
   const tb=$('topicBody');if(tb)tb.innerHTML=tr.length?tr.slice(0,15).map((r,i)=>`<tr><td>#${i+1}</td><td><b>${esc(r.topic)}</b></td><td>${fmt(r.posts)}</td><td>${fmt(r.views)}</td><td>${fmt(Math.round(r.avg))}</td><td>${fmt(r.top)}</td><td>${r.score==null?'—':r.score.toFixed(1)}</td><td>${recent.length?((r.posts/recent.length)*100).toFixed(1):'0.0'}%</td></tr>`).join(''):'<tr><td colspan="8" class="muted">No topic analytics available.</td></tr>';
   const ai=$('aiOverview');if(ai){const bestSuc=suc[0],bestTopic=[...tr].sort((a,b)=>b.avg-a.avg)[0],bestChannel=gr.filter(x=>x.avg_views_7d!=null).sort((a,b)=>Number(b.avg_views_7d)-Number(a.avg_views_7d))[0],bestTime=(await sb.from('posting_intelligence').select('*').order('performance_rank').limit(1)).data?.[0];const learns=[];if(bestSuc)learns.push(`<div class="aiLearn"><b>Likely winning pattern</b><div class="muted small">${esc(bestSuc.theme||'Content pattern')} · ${Number(bestSuc.success_likelihood_score||0).toFixed(0)}% likelihood · ${fmt(bestSuc.views||0)} observed views.</div></div>`);if(bestTopic)learns.push(`<div class="aiLearn"><b>Highest-view topic</b><div class="muted small">${esc(bestTopic.topic)} averages ${fmt(Math.round(bestTopic.avg))} views across ${fmt(bestTopic.posts)} posts.</div></div>`);if(bestChannel)learns.push(`<div class="aiLearn"><b>Strongest channel by average views</b><div class="muted small">${esc(bestChannel.account_name||bestChannel.handle)} · ${fmt(Math.round(bestChannel.avg_views_7d))} avg views in the 7-day window.</div></div>`);if(bestTime)learns.push(`<div class="aiLearn"><b>Best observed posting window</b><div class="muted small">${esc(bestTime.post_hour_label||bestTime.post_hour_ist)} · ${bestTime.avg_views==null?'—':fmt(Math.round(bestTime.avg_views))} avg views.</div></div>`);ai.innerHTML=learns.join('')||'<div class="muted">Not enough current evidence for AI learnings.</div>'}
 }
 function boot(){renderExecutive();setTimeout(renderExecutive,900);document.getElementById('accountFilter')?.addEventListener('change',renderExecutive);document.getElementById('refresh')?.addEventListener('click',()=>setTimeout(renderExecutive,150));}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.WinTurboExecutiveRefresh=renderExecutive;
})();
/* WINTURBO_EXECUTIVE_V26_END */
</script>
'''
s=s.replace('</body>',js+'\n</body>',1)
p.write_text(s,encoding='utf-8')
print('Executive Summary rebuilt with live audience ranking, AI learnings, channel-wise links, trending posts and topic analytics.')
