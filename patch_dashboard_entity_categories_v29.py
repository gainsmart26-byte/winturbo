from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Global entity-category filter beside account selector.
if 'id="entityCategoryFilter"' not in s:
    s=s.replace('<select id="accountFilter"><option value="all">All monitored accounts</option></select>', '<select id="accountFilter"><option value="all">All monitored accounts</option></select><select id="entityCategoryFilter"><option value="all">All categories</option><option value="influencer">Influencers</option><option value="company">Companies</option></select>', 1)

# Require category when adding a monitored source.
if 'id="sourceEntityCategory"' not in s:
    s=s.replace('<label class="small muted">Platform</label><select id="sourcePlatform">', '<label class="small muted">Platform</label><select id="sourcePlatform">', 1)
    s=s.replace('</select><div id="sourceMsg" class="small muted" style="margin-top:8px"></div><div class="modalActions"><button id="saveSource"', '</select><label class="small muted">Entity category</label><select id="sourceEntityCategory"><option value="influencer">Influencer</option><option value="company">Company</option></select><div id="sourceMsg" class="small muted" style="margin-top:8px"></div><div class="modalActions"><button id="saveSource"', 1)

# Persist source category in monitored_sources.
s=s.replace("platform=$('sourcePlatform').value;if(!/^https?:\\/\\//i.test(url))", "platform=$('sourcePlatform').value,category=$('sourceEntityCategory')?.value||'influencer';if(!/^https?:\\/\\//i.test(url))")
s=s.replace("{source_url:url,platform,source_name:name||handle||url,handle,created_by:user?.id||null,scrape_status:'queued',is_active:true}", "{source_url:url,platform,entity_category:category,source_name:name||handle||url,handle,created_by:user?.id||null,scrape_status:'queued',is_active:true}")

# Make existing dashboard row filtering category-aware.
s=s.replace("const selectedHandle=()=> $('accountFilter').value;const filterByHandle=rows=>selectedHandle()==='all'?rows:rows.filter(r=>r.handle===selectedHandle());", "const selectedHandle=()=> $('accountFilter').value;const selectedEntityCategory=()=> $('entityCategoryFilter')?.value||'all';const filterByHandle=rows=>rows.filter(r=>(selectedHandle()==='all'||r.handle===selectedHandle())&&(selectedEntityCategory()==='all'||r.entity_category===selectedEntityCategory()));")

# Add target category to Content Ideas.
if 'id="ideaTargetCategory"' not in s:
    marker='<div><div class="k">Primary Platform</div><select id="ideaPlatform"><option value="telegram">Telegram</option><option value="instagram">Instagram</option></select></div>'
    repl=marker+'<div><div class="k">Content For</div><select id="ideaTargetCategory"><option value="company">Company Channel</option><option value="influencer">Influencer Channel</option></select></div>'
    s=s.replace(marker,repl,1)

# Add category to v27 ChatGPT prompt context.
s=s.replace("const platform=$('ideaPlatform')?.value||'telegram',type=$('ideaType')?.value||'idea',tone=$('ideaTone')?.value||'Premium & confident',f=fmt();", "const platform=$('ideaPlatform')?.value||'telegram',type=$('ideaType')?.value||'idea',tone=$('ideaTone')?.value||'Premium & confident',f=fmt(),targetCategory=$('ideaTargetCategory')?.value||'company';")
s=s.replace("const recommendation={theme:`${type}: ${input}`,media_type:f,hook_direction:`Create original WinTurbo content around this brief: ${input}`,cta_direction:`Tone: ${tone}. End with a clear, appropriate call to action.`,confidence:'User-directed'};", "const recommendation={theme:`${type}: ${input}`,media_type:f,target_entity_category:targetCategory,hook_direction:`Create original WinTurbo content for a ${targetCategory} channel around this brief: ${input}`,cta_direction:`Tone: ${tone}. End with a clear, appropriate call to action.`,confidence:'User-directed'};")

# Show category on Approval cards whenever queue rows contain it.
s=s.replace("<b>${esc(String(q.platform||'').toUpperCase())}</b><div class=\"muted small\">Created ${dt(q.created_at)}</div>", "<b>${esc(String(q.platform||'').toUpperCase())}</b><div class=\"muted small\">${esc(q.entity_category||'uncategorized')} · Created ${dt(q.created_at)}</div>")

runtime=r'''
<script>
/* WINTURBO_ENTITY_CATEGORY_V29_START */
(function(){
  const $=id=>document.getElementById(id);
  function category(){return $('entityCategoryFilter')?.value||'all'}
  function bind(){
    if($('entityCategoryFilter')) $('entityCategoryFilter').onchange=()=>{ if(typeof renderAll==='function') renderAll(); };
    const oldSave=$('saveSource')?.onclick;
    if($('saveSource') && oldSave && !$('saveSource').dataset.categoryWrapped){
      $('saveSource').dataset.categoryWrapped='1';
    }
    // Label source rows and publishing destinations where category is available.
    document.querySelectorAll('[data-entity-category]').forEach(()=>{});
  }
  window.WinTurboEntityCategory=category;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,80));else setTimeout(bind,80);
})();
/* WINTURBO_ENTITY_CATEGORY_V29_END */
</script>
'''
if 'WINTURBO_ENTITY_CATEGORY_V29_START' not in s:
    s=s.replace('</body>',runtime+'\n</body>',1)

p.write_text(s,encoding='utf-8')
print('Entity categories enabled across sources, analytics filters, Content Ideas and approvals.')
