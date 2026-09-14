from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Remove prior v31 runtime/style so the patch is idempotent.
s=re.sub(r'\n?/\* WINTURBO_QUALITY_ACTIONS_V31_CSS \*/.*?(?=\n/\*|\n</style>)','',s,flags=re.S)
s=re.sub(r'<script>\s*/\* WINTURBO_QUALITY_ACTIONS_V31_START \*/.*?/\* WINTURBO_QUALITY_ACTIONS_V31_END \*/\s*</script>','',s,flags=re.S)

# Clarify the recommendation heading and add a load-more control if absent.
s=s.replace('Likely to Be Successful for WinTurbo</h2><div class="muted small">Up to 20 high-performing evidence cards. Use any card to create Telegram copy, Instagram copy, a ChatGPT text draft, or an image creative.</div>',
'''Likely to Be Successful for WinTurbo</h2><div class="muted small">Evidence-ranked ideas with inline ChatGPT generation and direct routing to the Approval queue for Telegram or Instagram.</div>''')

if 'id="qualityLoadMore"' not in s:
    s=s.replace('<div id="aiRecommendations" class="recommendationGrid"><div class="muted">Loading recommendation evidence…</div></div>',
'''<div id="aiRecommendations" class="recommendationGrid"><div class="muted">Loading recommendation evidence…</div></div>\n  <div style="display:flex;justify-content:center;margin-top:16px"><button id="qualityLoadMore" class="ghost">Load More Recommendations</button></div>''',1)

css=r'''
/* WINTURBO_QUALITY_ACTIONS_V31_CSS */
#quality .v31RecGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
#quality .v31Rec{border:1px solid rgba(66,227,108,.34);background:linear-gradient(160deg,rgba(19,62,31,.66),rgba(9,24,14,.94));border-radius:16px;padding:16px}
#quality .v31RecHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v31RecScore{font-size:28px;font-weight:950;color:#b8ffc7}
#quality .v31RecMeta{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0}.v31RecMetrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:11px 0}
#quality .v31RecMetric{background:#09110c;border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:8px}.v31RecMetric b{display:block;font-size:15px}.v31RecMetric span{display:block;color:var(--muted);font-size:10px}
#quality .v31Controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.v31Controls select{min-width:0}
#quality .v31Actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.v31Generated{margin-top:10px;padding:11px;background:#08100b;border:1px solid var(--line);border-radius:10px;white-space:pre-wrap;max-height:260px;overflow:auto}.v31Generated.hide{display:none!important}
#quality .v31Status{margin-top:7px;font-size:11px;color:var(--muted)}
@media(max-width:900px){#quality .v31RecGrid{grid-template-columns:1fr}#quality .v31RecMetrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
'''
s=s.replace('</style>',css+'\n</style>',1)

js=r'''
<script>
/* WINTURBO_QUALITY_ACTIONS_V31_START */
(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const n=v=>new Intl.NumberFormat('en-IN').format(Number(v)||0);
  const dt=v=>v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}):'—';
  let rows=[];let visible=30;let loading=false;const drafts=new Map();
  const rowKey=r=>String(r.id||`${r.handle||''}:${r.platform_post_id||r.posted_at||Math.random()}`);
  const selectedAccount=()=>document.getElementById('accountFilter')?.value||'all';
  const selectedCategory=()=>document.getElementById('entityCategoryFilter')?.value||'all';
  const filtered=()=>rows.filter(r=>(selectedAccount()==='all'||r.handle===selectedAccount())&&(selectedCategory()==='all'||r.entity_category===selectedCategory())).sort((a,b)=>Number(b.success_likelihood_score||0)-Number(a.success_likelihood_score||0));

  function promptFor(r,targetCategory,platform){
    const who=targetCategory==='influencer'?'an influencer-led WinTurbo channel':'a WinTurbo company/brand channel';
    return {recommendation:{theme:r.theme||'High-performing observed pattern',media_type:'text',hook_direction:`Create an original ${platform} post for ${who} inspired by this observed hook: ${r.hook||r.post_text||'strong opening'}`,cta_direction:'Use a clear, accurate CTA. Do not copy the source verbatim and do not invent guarantees or performance claims.',confidence:r.confidence||'Directional'},evidence:[{account_name:r.account_name,handle:r.handle,entity_category:r.entity_category,post_text:r.post_text,hook:r.hook,views:r.views,reactions_count:r.reactions_count,creative_score:r.creative_score,success_likelihood_score:r.success_likelihood_score}]};
  }

  function card(r,i){
    const key=rowKey(r),draft=drafts.get(key)||'';
    const score=Number(r.success_likelihood_score||0);
    const sourceCategory=r.entity_category==='company'?'Company':'Influencer';
    const sourceUrl=r.post_url?`<a target="_blank" rel="noopener" href="${esc(r.post_url)}">Open evidence ↗</a>`:'';
    return `<article class="v31Rec" data-v31-card="${esc(key)}"><div class="v31RecHead"><div><b>#${i+1} ${esc(r.theme||'High-performing pattern')}</b><div class="muted small">${esc(r.account_name||r.handle||'Observed source')} · ${sourceCategory} · ${dt(r.posted_at)}</div></div><div class="v31RecScore">${score.toFixed(0)}%</div></div><div class="v31RecMeta"><span class="pill">${esc(r.confidence||'Directional')} confidence</span><span class="pill blue">${esc(r.media_type||'content')}</span></div><div class="v31RecMetrics"><div class="v31RecMetric"><b>${n(r.views)}</b><span>Views</span></div><div class="v31RecMetric"><b>${r.reactions_count==null?'N/A':n(r.reactions_count)}</b><span>Reactions</span></div><div class="v31RecMetric"><b>${r.creative_score==null?'N/A':Number(r.creative_score).toFixed(0)}</b><span>Creative Score</span></div><div class="v31RecMetric"><b>${n(r.pattern_sample_size||0)}</b><span>Pattern Sample</span></div></div><div><b>Why it may work:</b> ${esc(r.rationale||'Positive observed evidence in the current dataset.')}</div><div class="muted small" style="margin-top:7px"><b>Hook:</b> ${esc((r.hook||r.post_text||'').slice(0,220))}</div>${sourceUrl?`<div style="margin-top:7px">${sourceUrl}</div>`:''}<div class="v31Controls"><select class="v31Platform"><option value="telegram">Telegram</option><option value="instagram">Instagram</option></select><select class="v31Target"><option value="company">Content for Company</option><option value="influencer">Content for Influencer</option></select></div><div class="v31Actions"><button class="primary v31Generate" data-key="${esc(key)}">Generate with ChatGPT</button><button class="ghost v31Approve" data-key="${esc(key)}" ${draft?'':'disabled'}>Send to Approval</button></div><div class="v31Generated ${draft?'':'hide'}">${esc(draft)}</div><div class="v31Status">${draft?'ChatGPT draft ready. Choose Telegram or Instagram, then send to Approval.':'Generate an original draft from this evidence.'}</div></article>`;
  }

  function render(){
    const host=$('aiRecommendations');if(!host)return;
    const all=filtered(),show=all.slice(0,visible);host.className='v31RecGrid';host.dataset.v31Rendered='1';host.innerHTML=show.length?show.map(card).join(''):'<div class="muted">No recommendation evidence matches the selected filters.</div>';
    const more=$('qualityLoadMore');if(more){more.style.display=visible<all.length?'inline-flex':'none';more.textContent=`Load More Recommendations (${Math.max(0,all.length-visible)} remaining)`;}
  }

  async function load(){
    if(loading)return;loading=true;
    try{const {data,error}=await sb.from('content_success_intelligence').select('*').order('success_likelihood_score',{ascending:false}).limit(100);if(error)throw error;rows=data||[];render();}
    catch(e){const host=$('aiRecommendations');if(host){host.dataset.v31Rendered='1';host.innerHTML=`<div class="muted">Recommendation load failed: ${esc(e?.message||e)}</div>`;}}
    finally{loading=false}
  }

  async function generate(btn){
    const card=btn.closest('[data-v31-card]');if(!card)return;const key=btn.dataset.key,r=rows.find(x=>rowKey(x)===key);if(!r)return;
    const platform=card.querySelector('.v31Platform')?.value||'telegram',target=card.querySelector('.v31Target')?.value||'company';const old=btn.textContent;btn.disabled=true;btn.textContent='Generating…';card.querySelector('.v31Status').textContent='ChatGPT is creating an original draft from the recommendation evidence…';
    try{const body=promptFor(r,target,platform);const {data,error}=await sb.functions.invoke('generate-social-post',{body:{platform,...body}});if(error)throw error;if(data?.error)throw new Error(data.error);const text=data?.text||'';if(!text)throw new Error('No content returned');drafts.set(key,text);card.querySelector('.v31Generated').textContent=text;card.querySelector('.v31Generated').classList.remove('hide');card.querySelector('.v31Approve').disabled=false;card.querySelector('.v31Status').textContent='ChatGPT draft ready. Review it, choose the destination, then send to Approval.';}
    catch(e){card.querySelector('.v31Status').textContent=`Generation failed: ${e?.message||e}`;}
    finally{btn.disabled=false;btn.textContent=old}
  }

  async function sendApproval(btn){
    const card=btn.closest('[data-v31-card]');if(!card)return;const key=btn.dataset.key,r=rows.find(x=>rowKey(x)===key),text=drafts.get(key);if(!r||!text)return;
    const platform=card.querySelector('.v31Platform')?.value||'telegram',target=card.querySelector('.v31Target')?.value||'company';const old=btn.textContent;btn.disabled=true;btn.textContent='Sending…';
    try{const {data:{user}}=await sb.auth.getUser();const {error}=await sb.from('publishing_queue').insert({platform,entity_category:target,source_handle:r.handle||null,source_post_url:r.post_url||null,content_text:text,media_type:'text',status:'draft',created_by:user?.id||null});if(error)throw error;card.querySelector('.v31Status').textContent=`Sent to Approval ✓ · ${platform==='telegram'?'Telegram':'Instagram'} · ${target==='company'?'Company':'Influencer'}`;btn.textContent='In Approval ✓';setTimeout(()=>{btn.textContent=old;btn.disabled=false},1600);if(typeof window.WinTurboExecutiveRefresh==='function')window.WinTurboExecutiveRefresh();}
    catch(e){card.querySelector('.v31Status').textContent=`Approval queue failed: ${e?.message||e}`;btn.disabled=false;btn.textContent=old;}
  }

  function bind(){
    document.addEventListener('click',e=>{const g=e.target.closest?.('.v31Generate');if(g){e.preventDefault();generate(g);return}const a=e.target.closest?.('.v31Approve');if(a){e.preventDefault();sendApproval(a);return}},true);
    $('qualityLoadMore')?.addEventListener('click',()=>{visible+=20;render()});
    $('accountFilter')?.addEventListener('change',()=>{visible=30;render()});$('entityCategoryFilter')?.addEventListener('change',()=>{visible=30;render()});
    const host=$('aiRecommendations');if(host){new MutationObserver(()=>{if(host.dataset.v31Rendered!=='1'){setTimeout(render,0)}}).observe(host,{childList:true,subtree:false});}
    load();setTimeout(load,1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
/* WINTURBO_QUALITY_ACTIONS_V31_END */
</script>
'''
s=s.replace('</body>',js+'\n</body>',1)
p.write_text(s,encoding='utf-8')
print('Quality v31: 30+ evidence cards, inline ChatGPT generation, and direct Telegram/Instagram approval routing.')
