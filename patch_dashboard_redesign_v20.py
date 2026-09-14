from pathlib import Path
import re

p = Path('dashboard.html')
s = p.read_text(encoding='utf-8')

# Remove older layout/firewall CSS blocks that are superseded by v20.
for marker in [
    'WINTURBO_FINAL_SECTIONS_LAYOUT_V14',
    'WINTURBO_DOM_NORMALIZER_V15_CSS',
    'WINTURBO_SECTION_FIREWALL_V19_CSS',
    'WINTURBO_REDESIGN_V20_CSS',
]:
    s = re.sub(r'\n?/\*\s*' + re.escape(marker) + r'\s*\*/.*?(?=\n/\*|\n</style>)', '', s, flags=re.S)

# Remove repeated click-card rules created by the historical patch chain.
click_rule = r'\.clickCard\{cursor:pointer;transition:transform \.15s,border-color \.15s\}\.clickCard:hover\{transform:translateY\(-2px\);border-color:#42e36c\}'
s = re.sub('(?:' + click_rule + ')+', '.clickCard{cursor:pointer;transition:transform .15s,border-color .15s}.clickCard:hover{transform:translateY(-2px);border-color:#42e36c}', s)

# Remove older normalizer/declutter/firewall JS so there is only one navigation authority.
for a, b in [
    ('WINTURBO_DOM_NORMALIZER_V15_START','WINTURBO_DOM_NORMALIZER_V15_END'),
    ('WINTURBO_FINAL_DECLUTTER_V18_START','WINTURBO_FINAL_DECLUTTER_V18_END'),
    ('WINTURBO_SECTION_FIREWALL_V19_START','WINTURBO_SECTION_FIREWALL_V19_END'),
    ('WINTURBO_REDESIGN_V20_START','WINTURBO_REDESIGN_V20_END'),
]:
    s = re.sub(r'/\*\s*' + re.escape(a) + r'\s*\*/.*?/\*\s*' + re.escape(b) + r'\s*\*/', '', s, flags=re.S)

css = r'''
/* WINTURBO_REDESIGN_V20_CSS */
:root{--bg:#070a08;--panel:#101611;--panel2:#0c120e;--line:#233027;--text:#f5f7f5;--muted:#8fa097;--green:#42e36c;--orange:#ff9d2e;--red:#ff6666;--blue:#67b7ff;--shadow:0 16px 42px rgba(0,0,0,.22)}
body{background:radial-gradient(circle at 72% -15%,rgba(66,227,108,.08),transparent 32%),var(--bg)}
.shell{grid-template-columns:272px minmax(0,1fr)}
.sidebar{background:rgba(9,13,10,.96);backdrop-filter:blur(14px);padding:24px 18px;border-right:1px solid #1c271f;z-index:5}
.sidebar .brand{font-size:25px;letter-spacing:-.04em}.sidebar>.muted{margin-top:2px}
.nav{gap:7px;margin-top:24px}.nav button{display:flex;align-items:center;gap:8px;padding:12px 13px;border-radius:12px;font-weight:750;transition:.18s ease}.nav button:hover{background:#111a13;color:#fff}.nav button.on{background:linear-gradient(90deg,rgba(66,227,108,.16),rgba(66,227,108,.05));border-color:rgba(66,227,108,.26);color:#dfffe6;box-shadow:inset 3px 0 0 var(--green)}
.main{padding:24px clamp(18px,3vw,42px) 56px;max-width:1680px;width:100%;margin:0 auto}
.topbar{position:sticky;top:0;z-index:4;padding:12px 0 15px;background:linear-gradient(180deg,var(--bg) 72%,rgba(7,10,8,0));margin-bottom:10px}.topbar h1{font-size:clamp(24px,2.3vw,34px);letter-spacing:-.04em}.toolbar{gap:9px}.toolbar select,.toolbar button{min-height:42px}
.card{border-color:#202d24;border-radius:16px;background:linear-gradient(180deg,rgba(18,26,20,.98),rgba(13,19,15,.98));box-shadow:var(--shadow)}
.grid4{gap:14px;margin:16px 0}.grid2{gap:14px}.k{font-size:10px;font-weight:850}.v{font-size:clamp(22px,2vw,30px);letter-spacing:-.035em}
.sectionHead{margin:6px 0 14px}.sectionHead h2{font-size:20px;letter-spacing:-.025em;margin:0}.sectionHead .muted{max-width:760px}
.tableWrap{background:#0c120e;border-color:#202c23;border-radius:15px;box-shadow:var(--shadow)}th{position:sticky;top:0;background:#0f1611;z-index:1}tr:hover td{background:#101812}
.primary,.ghost,.mini{transition:.16s ease}.primary:hover,.ghost:hover,.mini:hover{transform:translateY(-1px)}
textarea{min-height:130px}.generated{border:1px solid #203026;border-radius:12px;padding:13px;background:#0a0f0c}
main.main > section.section{display:none!important;position:relative!important;width:100%!important;max-width:100%!important;clear:both!important;float:none!important}
main.main > section.section.on{display:block!important}
main.main > section.section section.section{display:none!important}
main.main > *:not(.topbar):not(section.section){display:none!important}
#verification .successGrid,#verification .recGrid,#verification .successCard,#verification .recCard,#verification .aiItem{display:none!important}
#contentIdeas .successGrid,#contentIdeas .recGrid,#contentIdeas .successCard,#contentIdeas .recCard,#contentIdeas .aiItem{display:none!important}
#quality,#verification,#contentIdeas{isolation:isolate}
@media(max-width:1050px){.shell{grid-template-columns:220px minmax(0,1fr)}.sidebar{padding:20px 13px}}
@media(max-width:800px){.shell{grid-template-columns:1fr}.sidebar{position:relative;height:auto}.nav{grid-template-columns:repeat(2,minmax(0,1fr))}.main{padding:14px}.topbar{position:relative}.toolbar{width:100%}.toolbar>*{flex:1 1 180px}.grid4,.grid2,.recGrid,.successGrid{grid-template-columns:1fr!important}}
'''

if '</style>' not in s:
    raise SystemExit('style closing tag not found')
s = s.replace('</style>', css + '\n</style>', 1)

js = r'''
<script>
/* WINTURBO_REDESIGN_V20_START */
(function(){
  const IDS=['overview','growth','creative','telegramSources','otherSources','timing','quality','verification','contentIdeas'];
  const TITLES={overview:'Executive Overview',growth:'Growth Analytics',creative:'Creative Explorer',telegramSources:'Telegram Sources',otherSources:'Instagram & Web',timing:'Posting Intelligence',quality:'Data Quality & AI',verification:'Verification',contentIdeas:'Content Ideas'};
  let active='overview', repairing=false;

  function qualityLeak(node){
    const t=(node.textContent||'').replace(/\s+/g,' ').trim();
    if(!t) return false;
    return /Data Quality & AI Recommendations|Data Quality Rules|Monitored Data Sources|AI Content Recommendations|Telegram Evidence|Instagram Evidence|Web Evidence|AI Recommendation Output|Public \/ Authorized/i.test(t);
  }

  function removeLeakedQuality(sec){
    if(!sec || sec.id==='quality') return;
    [...sec.children].forEach(el=>{
      if(el.classList && el.classList.contains('sectionHead')) return;
      if(qualityLeak(el)){
        const hasProtected=el.querySelector && el.querySelector('#telegramPublishStatus,#telegramPublishingAccounts,#telegramPermissionDetail,#verifyTelegramConnection,#telegramVerifyMessage,#ideaType,#ideaPlatform,#ideaInput,#ideaTone,#ideaFormat,#imageEngine,#generateIdeaContent,#ideaStatus,#ideaDraft,#higgsfieldGenerationStatus,#higgsfieldPreview,#readyPostCopy,#readyPostMedia,#publishIdeaTelegram');
        if(!hasProtected) el.remove();
      }
    });
  }

  function normalize(){
    if(repairing) return;
    repairing=true;
    const main=document.querySelector('main.main');
    if(!main){repairing=false;return;}
    const topbar=main.querySelector(':scope > .topbar') || document.querySelector('.topbar');
    if(topbar && topbar.parentElement!==main) main.prepend(topbar);

    IDS.forEach(id=>{
      const all=[...document.querySelectorAll('section#'+id)];
      if(!all.length) return;
      const keep=all[all.length-1];
      all.slice(0,-1).forEach(x=>x.remove());
      [...keep.querySelectorAll('section.section')].forEach(x=>x.remove());
      if(keep.parentElement!==main) main.appendChild(keep);
      removeLeakedQuality(keep);
    });

    [...main.children].forEach(el=>{
      if(el===topbar) return;
      if(el.matches && el.matches('section.section') && IDS.includes(el.id)) return;
      el.remove();
    });
    IDS.forEach(id=>{const sec=document.getElementById(id);if(sec) main.appendChild(sec)});
    show(active,false);
    repairing=false;
  }

  function show(id,scroll=true){
    if(!IDS.includes(id)) id='overview';
    active=id;
    IDS.forEach(x=>{
      const sec=document.getElementById(x);
      if(!sec) return;
      const on=x===id;
      sec.classList.toggle('on',on);
      sec.style.setProperty('display',on?'block':'none','important');
      sec.setAttribute('aria-hidden',on?'false':'true');
    });
    document.querySelectorAll('.nav button[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s===id));
    const title=document.getElementById('title'); if(title) title.textContent=TITLES[id]||id;
    if(scroll) window.scrollTo({top:0,behavior:'smooth'});
  }

  document.addEventListener('click',function(e){
    const b=e.target.closest && e.target.closest('.nav button[data-s]');
    if(!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    show(b.dataset.s);
  },true);

  function boot(){
    const selected=document.querySelector('.nav button.on[data-s]');
    active=selected && IDS.includes(selected.dataset.s)?selected.dataset.s:'overview';
    normalize();
    const main=document.querySelector('main.main');
    if(main){
      const mo=new MutationObserver(()=>{ if(!repairing) requestAnimationFrame(normalize); });
      mo.observe(main,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    }
    setTimeout(normalize,300); setTimeout(normalize,1200);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
/* WINTURBO_REDESIGN_V20_END */
</script>
'''

if '</body>' not in s:
    raise SystemExit('body closing tag not found')
s = s.replace('</body>', js + '\n</body>', 1)

p.write_text(s, encoding='utf-8')
print('Applied WinTurbo redesign v20: clean navigation, isolated sections, responsive UI.')
