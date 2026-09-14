from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Expand Posting Intelligence columns to include channel/post identity.
old='<div class="tableWrap"><table><thead><tr><th>Rank</th><th>Time</th><th>Posts</th><th>Competitors</th><th>Avg Views</th><th>Median Views</th><th>Top Views</th><th>Avg Reactions</th><th>Creative Score</th><th>Evidence</th></tr></thead><tbody id="timingBody"><tr><td colspan="10" class="muted">Loading posting intelligence…</td></tr></tbody></table></div>'
new='<div class="tableWrap"><table><thead><tr><th>Rank</th><th>Time</th><th>Channel / Account</th><th>Post</th><th>Posts</th><th>Competitors</th><th>Avg Views</th><th>Median Views</th><th>Top Views</th><th>Avg Reactions</th><th>Creative Score</th><th>Open</th></tr></thead><tbody id="timingBody"><tr><td colspan="12" class="muted">Loading posting intelligence…</td></tr></tbody></table></div>'
if old in s:
    s=s.replace(old,new,1)

pat=r'''  function renderTiming\(rows\)\{.*?\n  \}\n\n  function recommendationPrompt'''
replacement=r'''  function renderTiming(rows){
    const ti=[...rows].sort((a,b)=>Number(a.performance_rank||999)-Number(b.performance_rank||999));
    const best=ti[0];
    set('timingBestHour',best?.post_hour_label||'—');
    set('timingAvgViews',best?.avg_views==null?'—':n(Math.round(best.avg_views)));
    set('timingTopViews',best?.top_views==null?'—':n(best.top_views));
    set('timingPostsAnalyzed',n(ti.reduce((a,r)=>a+Number(r.posts_count||0),0)));
    const body=$('timingBody');if(!body)return;
    const flat=[];
    ti.forEach(bucket=>{
      let detail=[];
      try{detail=Array.isArray(bucket.posts_detail)?bucket.posts_detail:[]}catch{}
      if(detail.length){
        detail.forEach((d,idx)=>flat.push({bucket,d,idx}));
      }else{
        flat.push({bucket,d:null,idx:0});
      }
    });
    body.innerHTML=flat.length?flat.map(({bucket:r,d,idx})=>{
      const u=d?postUrl(d):null;
      const channel=d?(d.account_name||d.handle||'Unknown channel'):'No post detail';
      const handle=d?.handle?`@${String(d.handle).replace(/^@/,'')}`:'';
      const text=d?.post_text?String(d.post_text).replace(/\\n/g,' ').slice(0,120):'—';
      const posted=d?.posted_at?dt(d.posted_at):'';
      const first=idx===0;
      return `<tr><td>${first?'#'+(r.performance_rank??'—'):''}</td><td>${first?`<b>${esc(r.post_hour_label||r.post_hour_ist)}</b>`:''}</td><td><b>${esc(channel)}</b>${handle?`<div class="muted small">${esc(handle)}</div>`:''}</td><td>${esc(text)}${posted?`<div class="muted small">${esc(posted)}</div>`:''}</td><td>${first?n(r.posts_count):''}</td><td>${first?n(r.competitors_posting):''}</td><td>${first?(r.avg_views==null?'—':n(Math.round(r.avg_views))):''}</td><td>${first?(r.median_views==null?'—':n(Math.round(r.median_views))):''}</td><td>${first?(r.top_views==null?'—':n(r.top_views)):''}</td><td>${first?(r.avg_reactions==null?'Not visible':f1(r.avg_reactions)):''}</td><td>${first?(r.avg_creative_score==null?'—':f1(r.avg_creative_score)):''}</td><td>${u?`<a class="openExternal" target="_blank" rel="noopener noreferrer" href="${esc(u)}">Open post ↗</a>`:'—'}</td></tr>`;
    }).join(''):'<tr><td colspan="12" class="muted">No posting intelligence available yet.</td></tr>';
  }

  function recommendationPrompt'''
s,n=re.subn(pat,replacement,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit('renderTiming function not found')

p.write_text(s,encoding='utf-8')
print('Posting Intelligence now shows channel/account identity, post text, timestamp and direct source link.')
