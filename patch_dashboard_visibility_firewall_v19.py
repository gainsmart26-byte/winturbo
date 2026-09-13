from pathlib import Path

p=Path('dashboard.html')
s=p.read_text()

css='''
/* WINTURBO_SECTION_FIREWALL_V19_CSS */
main.main > *:not(.topbar):not(section.section){display:none!important}
main.main > section.section{display:none!important}
main.main > section.section.on{display:block!important}
main.main > section.section section.section{display:none!important}
#verification .successGrid,#verification .recGrid,#verification .successCard,#verification .recCard,#verification .aiItem{display:none!important}
#contentIdeas .successGrid,#contentIdeas .recGrid,#contentIdeas .successCard,#contentIdeas .recCard,#contentIdeas .aiItem{display:none!important}
'''
if 'WINTURBO_SECTION_FIREWALL_V19_CSS' not in s:
    s=s.replace('</style>',css+'\n</style>',1)

js=r'''
/* WINTURBO_SECTION_FIREWALL_V19_START */
(function(){
  const ids=['overview','growth','creative','telegramSources','otherSources','timing','quality','verification','contentIdeas'];
  let observer=null;
  let repairing=false;

  function removeQualityLeakage(sec){
    if(!sec || sec.id==='quality') return;

    // Entire quality-only structures must never render in another tab.
    sec.querySelectorAll('.successGrid,.recGrid,.successCard,.recCard,.aiItem').forEach(el=>{
      if(sec.id==='verification' || sec.id==='contentIdeas') el.remove();
    });

    const qualityTerms=[
      'Data Quality & AI Recommendations',
      'Data Quality Rules',
      'Monitored Data Sources',
      'AI Content Recommendations',
      'Public / Authorized',
      'Telegram Evidence',
      'Instagram Evidence',
      'Web Evidence',
      'AI Recommendation Output',
      'Generate Telegram Post',
      'Generate Instagram Post'
    ];

    [...sec.querySelectorAll('.card,.grid2,.grid4')].reverse().forEach(el=>{
      const text=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(!text) return;
      if(!qualityTerms.some(t=>text.includes(t))) return;

      // Protect the canonical controls that legitimately belong to these sections.
      const protectedIds=[
        'telegramPublishStatus','telegramPublishingAccounts','telegramPermissionDetail','verifyTelegramConnection','telegramVerifyMessage',
        'ideaType','ideaPlatform','ideaInput','ideaTone','ideaFormat','imageEngine','generateIdeaContent','ideaStatus','ideaDraft',
        'higgsfieldGenerationStatus','higgsfieldPreview','readyPostCopy','readyPostMedia','publishIdeaTelegram'
      ];
      if(protectedIds.some(id=>el.id===id || el.querySelector?.('#'+id))) return;
      el.remove();
    });
  }

  function repair(){
    if(repairing) return;
    repairing=true;
    try{
      const main=document.querySelector('main.main');
      if(!main) return;

      if(observer) observer.disconnect();

      // Keep exactly one copy of every known section and make every section a direct child of main.
      ids.forEach(id=>{
        const copies=[...document.querySelectorAll('section#'+id)];
        if(!copies.length) return;
        const keep=copies[copies.length-1];
        copies.slice(0,-1).forEach(x=>x.remove());
        keep.classList.add('section');
        if(keep.parentElement!==main) main.appendChild(keep);
      });

      // Remove all loose dashboard fragments. These are the source of the cross-tab leakage seen in the video.
      [...main.children].forEach(el=>{
        if(el.classList.contains('topbar')) return;
        if(el.matches('section.section') && ids.includes(el.id)) return;
        el.remove();
      });

      // Strip nested copies and quality-only fragments from non-quality sections.
      ids.forEach(id=>{
        const sec=document.getElementById(id);
        if(!sec) return;
        sec.querySelectorAll('section.section').forEach(nested=>nested.remove());
        removeQualityLeakage(sec);
      });

      // Preserve navigation order.
      ids.forEach(id=>{const sec=document.getElementById(id);if(sec)main.appendChild(sec)});

      let active=document.querySelector('.nav button.on[data-s]')?.dataset.s;
      if(!active || !ids.includes(active)) active='overview';
      ids.forEach(id=>document.getElementById(id)?.classList.toggle('on',id===active));
      document.querySelectorAll('.nav button[data-s]').forEach(btn=>btn.classList.toggle('on',btn.dataset.s===active));

      if(observer) observer.observe(main,{childList:true,subtree:true});
    } finally {
      repairing=false;
    }
  }

  function install(){
    const main=document.querySelector('main.main');
    if(!main) return;
    repair();
    observer=new MutationObserver(()=>queueMicrotask(repair));
    observer.observe(main,{childList:true,subtree:true});
    document.querySelectorAll('.nav button[data-s]').forEach(btn=>{
      if(btn.dataset.v19Bound) return;
      btn.dataset.v19Bound='1';
      btn.addEventListener('click',()=>setTimeout(repair,0));
    });
    setTimeout(repair,250);
    setTimeout(repair,1000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
/* WINTURBO_SECTION_FIREWALL_V19_END */
'''

sm='/* WINTURBO_SECTION_FIREWALL_V19_START */'; em='/* WINTURBO_SECTION_FIREWALL_V19_END */'
while sm in s and em in s:
    a=s.find(sm); b=s.find(em,a)
    if b<0: break
    s=s[:a]+s[b+len(em):]

idx=s.rfind('</script>')
if idx==-1:
    raise SystemExit('No script closing tag found')
s=s[:idx]+js+'\n'+s[idx:]

p.write_text(s)
print('installed final section visibility firewall and removed cross-tab quality leakage')
