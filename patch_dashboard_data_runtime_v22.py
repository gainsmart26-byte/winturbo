from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Remove previous v22 runtime if re-run.
s=re.sub(r'<script>\s*/\* WINTURBO_DATA_RUNTIME_V22_START \*/.*?/\* WINTURBO_DATA_RUNTIME_V22_END \*/\s*</script>','',s,flags=re.S)

js=r'''
<script>
/* WINTURBO_DATA_RUNTIME_V22_START */
(function(){
  const q=id=>document.getElementById(id);
  const fmtN=n=>new Intl.NumberFormat('en-IN').format(Number(n)||0);
  const esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmtDate=v=>v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}):'—';
  const hourIST=v=>{if(!v)return '—';return new Date(v).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'})};
  let busy=false;

  function selected(){return q('accountFilter')?.value||'all'}
  function byHandle(rows){const h=selected();return h==='all'?rows:rows.filter(r=>r.handle===h)}
  function setText(id,v){const el=q(id);if(el)el.textContent=v}

  async function hydrate(){
    if(busy || typeof sb==='undefined') return;
    busy=true;
    try{
      const [a,g,c,sr,si]=await Promise.all([
        sb.from('accounts').select('account_name,handle,followers_current,last_seen_at').order('followers_current',{ascending:false}),
        sb.from('competitor_growth_analytics_v3').select('*').order('audience_rank'),
        sb.from('creative_leaderboard').select('*').order('posted_at',{ascending:false}).limit(500),
        sb.from('monitored_sources').select('*').order('created_at',{ascending:false}),
        sb.from('content_success_intelligence').select('*').order('success_likelihood_score',{ascending:false}).limit(200)
      ]);
      const accounts=a.data||[], growth=g.data||[], creative=c.data||[], sources=sr.data||[], success=si.data||[];
      const ac=byHandle(accounts), gr=byHandle(growth), cr=byHandle(creative), suc=byHandle(success);
      const activeSources=selected()==='all'?sources.filter(x=>x.is_active!==false):sources.filter(x=>x.is_active!==false&&x.handle===selected());

      // Keep filter usable even when legacy runtime failed.
      const filter=q('accountFilter');
      if(filter){
        const old=filter.value||'all';
        filter.innerHTML='<option value="all">All monitored accounts</option>'+accounts.map(x=>`<option value="${esc2(x.handle)}">${esc2(x.account_name||x.handle)}</option>`).join('');
        filter.value=[...filter.options].some(o=>o.value===old)?old:'all';
      }

      setText('accounts',ac.length);
      setText('members',fmtN(ac.reduce((z,x)=>z+Number(x.followers_current||0),0)));
      setText('overviewPosts',cr.length);
      setText('posts',cr.length);
      setText('views',fmtN(cr.reduce((z,x)=>z+Number(x.views||0),0)));
      setText('postAccounts',new Set(cr.map(x=>x.handle).filter(Boolean)).size);
      setText('activeLinks',activeSources.length);
      const lastScrape=activeSources.map(x=>x.last_scraped_at).filter(Boolean).sort().pop();
      setText('lastDataUpdate',lastScrape?fmtDate(lastScrape):'Waiting for scrape');
      if(q('lastDataUpdateSub')) q('lastDataUpdateSub').textContent=lastScrape?'Latest successful source scrape':'No successful scrape yet';

      const topCreative=[...cr].sort((x,y)=>Number(y.creative_score||0)-Number(x.creative_score||0))[0];
      setText('overviewTopScore',topCreative?.creative_score!=null?Number(topCreative.creative_score).toFixed(0):'—');
      setText('overviewTopName',topCreative?.account_name||'—');
      setText('topCreative',topCreative?.account_name||'—');
      if(q('topCreativeSub'))q('topCreativeSub').textContent=topCreative?`Score ${Number(topCreative.creative_score||0).toFixed(0)} · ${fmtN(topCreative.views||0)} views`:'—';

      // Growth analytics table fallback.
      const gb=q('growthBody');
      if(gb){gb.innerHTML=gr.length?gr.map(r=>`<tr><td>#${r.audience_rank??'—'}</td><td><b>${esc2(r.account_name||r.handle)}</b><div class="muted small">@${esc2(r.handle||'')}</div></td><td>${fmtN(r.followers_current)}</td><td>${fmtN(r.posts_today)}</td><td>${Number(r.avg_posts_per_day_7d||0).toFixed(2)}</td><td>${fmtN(r.active_post_days_7d||0)} / 7</td><td>${esc2(r.most_common_post_time_ist||'—')}</td><td>${fmtN(r.posts_at_most_common_hour_7d||0)}</td><td>${r.avg_views_7d==null?'—':fmtN(Math.round(r.avg_views_7d))}</td><td>${r.median_views_7d==null?'—':fmtN(Math.round(r.median_views_7d))}</td><td>${r.avg_view_rate_7d_pct==null?'—':Number(r.avg_view_rate_7d_pct).toFixed(2)+'%'}</td><td>${r.posts_with_reactions_7d>0?Number(r.reaction_visibility_pct||0).toFixed(0)+'% visible':'Not publicly visible'}</td><td>${fmtN(r.snapshot_count||0)} snapshots</td></tr>`).join(''):'<tr><td colspan="13" class="muted">No analytics yet.</td></tr>'}

      // Creative explorer fallback.
      const cb=q('creativeBody');
      if(cb){const rows=[...cr].sort((x,y)=>Number(y.creative_score||0)-Number(x.creative_score||0));cb.innerHTML=rows.length?rows.map((r,i)=>`<tr><td>#${i+1}</td><td><b>${esc2(r.account_name||r.handle)}</b></td><td>${r.post_url?`<a target="_blank" rel="noopener" href="${esc2(r.post_url)}">Open ↗</a>`:'—'}</td><td>${esc2((r.hook||r.post_text||'Media post').slice(0,90))}</td><td>${esc2(r.theme||'Unclassified')}</td><td>${esc2(r.media_type||'—')}</td><td>${fmtN(r.views)}</td><td>${r.observed_view_rate_pct==null?'—':Number(r.observed_view_rate_pct).toFixed(2)+'%'}</td><td class="score ${Number(r.creative_score)>=80?'high':'med'}">${r.creative_score==null?'—':Number(r.creative_score).toFixed(0)}</td><td>${fmtDate(r.posted_at)}</td></tr>`).join(''):'<tr><td colspan="10" class="muted">No scraped post data yet.</td></tr>'}

      // Source tabs show exactly what has/has not been fetched.
      const tgs=activeSources.filter(x=>String(x.platform).toLowerCase()==='telegram');
      const oth=activeSources.filter(x=>String(x.platform).toLowerCase()!=='telegram');
      setText('tgSourceCount',tgs.length); setText('otherSourceCount',oth.length);
      setText('tgLastUpdate',fmtDate(tgs.map(x=>x.last_scraped_at).filter(Boolean).sort().pop()));
      setText('otherLastUpdate',fmtDate(oth.map(x=>x.last_scraped_at).filter(Boolean).sort().pop()));
      const tgBody=q('tgSourcesBody');
      if(tgBody)tgBody.innerHTML=tgs.map(x=>`<tr><td><b>${esc2(x.source_name||x.handle)}</b></td><td>@${esc2(x.handle||'—')}</td><td>${esc2(x.scrape_status||'queued')}</td><td>${fmtDate(x.last_scraped_at)}</td><td>—</td><td>—</td><td><a target="_blank" rel="noopener" href="${esc2(x.source_url)}">Open ↗</a></td></tr>`).join('')||'<tr><td colspan="7" class="muted">No Telegram sources.</td></tr>';
      const otherBody=q('otherSourcesBody');
      if(otherBody)otherBody.innerHTML=oth.map(x=>`<tr><td><b>${esc2(x.source_name||x.source_url)}</b></td><td>${esc2(x.platform||'Web')}</td><td>${esc2(x.scrape_status||'queued')}</td><td>${fmtDate(x.last_scraped_at)}</td><td>—</td><td>—</td><td><a target="_blank" rel="noopener" href="${esc2(x.source_url)}">Open ↗</a></td></tr>`).join('')||'<tr><td colspan="7" class="muted">No Instagram/Web sources.</td></tr>';

      // Data quality metrics based on real stored data.
      const freshHours=lastScrape?(Date.now()-new Date(lastScrape).getTime())/36e5:null;
      setText('qualityStatus',cr.length?'Data available':'Awaiting data');
      setText('qualityCoverage',`${activeSources.length} active links`);
      setText('qualityFreshness',freshHours==null?'No scrape yet':freshHours<6?'Fresh':freshHours<24?'Recent':Math.round(freshHours)+'h old');
      const confCounts=suc.reduce((m,x)=>(m[x.confidence]=(m[x.confidence]||0)+1,m),{});
      setText('qualityConfidence',Object.keys(confCounts).length?Object.entries(confCounts).sort((a,b)=>b[1]-a[1])[0][0]:'Waiting');
      const badge=q('qualityHealthBadge');if(badge){badge.textContent=freshHours!=null&&freshHours<24?'DATA CURRENT':'REFRESH NEEDED';badge.className='pill '+(freshHours!=null&&freshHours<24?'':'orange')}

      const qs=q('qualitySources');
      if(qs)qs.innerHTML=activeSources.length?activeSources.map(x=>`<div class="qualitySource"><div><b>${esc2(x.source_name||x.handle||x.source_url)}</b><div class="muted small">${esc2(x.platform||'Source')} · ${x.last_scraped_at?'Updated '+fmtDate(x.last_scraped_at):'Not fetched yet'}${x.last_error?' · '+esc2(x.last_error):''}</div></div><span class="qualityState">${esc2(x.scrape_status||'queued')}</span></div>`).join(''):'<div class="muted">No active monitored links.</div>';

      // Evidence-based posting recommendations from scraped content_success_intelligence.
      const recHost=q('aiRecommendations');
      if(recHost){
        const candidates=[...suc].filter(x=>Number(x.success_likelihood_score||0)>0).sort((a,b)=>Number(b.success_likelihood_score)-Number(a.success_likelihood_score));
        const seen=new Set(), recs=[];
        for(const r of candidates){const key=(r.theme||'Unclassified')+'|'+(r.media_type||'');if(seen.has(key))continue;seen.add(key);recs.push(r);if(recs.length>=8)break}
        recHost.innerHTML=recs.length?recs.map((r,i)=>{
          const score=Number(r.success_likelihood_score||0), label=r.success_label|| (score>=75?'Likely to be successful':score>=60?'Promising':'Watch');
          const postingTime=hourIST(r.posted_at);
          return `<div class="aiItem"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><b>#${i+1} ${esc2(r.theme||'Content pattern')}</b><div class="muted small">Based on ${esc2(r.account_name||r.handle||'observed source')} · ${esc2(r.media_type||'content')} · observed around ${postingTime}</div></div><span class="pill ${score>=75?'':'orange'}">${score.toFixed(0)}% ${esc2(label)}</span></div><div style="margin-top:9px"><b>Recommended post direction:</b> ${esc2(r.hook||r.post_text||r.theme||'Use this winning content pattern').slice(0,220)}</div><div class="muted small" style="margin-top:7px">Evidence: ${fmtN(r.views||0)} views · creative score ${r.creative_score==null?'n/a':Number(r.creative_score).toFixed(0)} · pattern sample ${fmtN(r.pattern_sample_size||0)} · confidence ${esc2(r.confidence||'—')}.</div><div class="muted small" style="margin-top:5px">Why: ${esc2(r.rationale||'Observed performance and pattern strength support this recommendation.')}</div>${r.post_url?`<div style="margin-top:7px"><a target="_blank" rel="noopener" href="${esc2(r.post_url)}">View source evidence ↗</a></div>`:''}</div>`
        }).join(''):'<div class="aiItem muted">No recommendation evidence is available yet. Scraped post data will populate this automatically.</div>';
      }
    }catch(err){
      const h=q('aiRecommendations');if(h)h.innerHTML=`<div class="aiItem error">Dashboard data load failed: ${esc2(err?.message||err)}</div>`;
      console.error('WinTurbo data runtime',err);
    }finally{busy=false}
  }

  function boot(){
    const refresh=q('refresh');if(refresh)refresh.addEventListener('click',()=>setTimeout(hydrate,50));
    const filter=q('accountFilter');if(filter)filter.addEventListener('change',hydrate);
    hydrate(); setTimeout(hydrate,900); setTimeout(hydrate,2500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.WinTurboHydrate=hydrate;
})();
/* WINTURBO_DATA_RUNTIME_V22_END */
</script>
'''

if '</body>' not in s: raise SystemExit('body closing tag not found')
s=s.replace('</body>',js+'\n</body>',1)
p.write_text(s,encoding='utf-8')
print('Installed data hydration runtime and evidence-based posting recommendations.')
