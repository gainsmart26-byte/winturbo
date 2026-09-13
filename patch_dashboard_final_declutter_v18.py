from pathlib import Path

p=Path('dashboard.html')
s=p.read_text()

js=r'''
/* WINTURBO_FINAL_DECLUTTER_V18_START */
function winturboFinalDeclutter(){
  const verification=document.getElementById('verification');
  const contentIdeas=document.getElementById('contentIdeas');
  const quality=document.getElementById('quality');

  const purgeLeakage=(section)=>{
    if(!section)return;
    section.querySelectorAll('.successGrid,.recGrid,.aiItem').forEach(el=>el.remove());
    const badTerms=[
      'AI Content Recommendations',
      'Recommendation Post',
      'What this post',
      'Data Quality Rules',
      'Low confidence',
      'Generate Instagram Post',
      'Generate Telegram Post'
    ];
    [...section.querySelectorAll('.card, .grid2, .grid4, section, div')].reverse().forEach(el=>{
      if(el===section)return;
      const text=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(!text)return;
      if(badTerms.some(t=>text.includes(t))){
        const protectedIds=['telegramPublishStatus','telegramPublishingAccounts','telegramPermissionDetail','verifyTelegramConnection','telegramVerifyMessage','ideaType','ideaPlatform','ideaInput','ideaTone','ideaFormat','imageEngine','generateIdeaContent','ideaStatus','ideaDraft','higgsfieldGenerationStatus','higgsfieldPreview','readyPostCopy','readyPostMedia','publishIdeaTelegram'];
        if(protectedIds.some(id=>el.querySelector?.('#'+id)))return;
        el.remove();
      }
    });
  };

  purgeLeakage(verification);
  purgeLeakage(contentIdeas);

  if(quality){
    [...quality.querySelectorAll('.grid4,.grid2,.card')].reverse().forEach(el=>{
      const text=(el.textContent||'').replace(/\s+/g,' ').trim();
      const sourceBlock=(text.includes('Public / Authorized') && text.includes('Apify') && text.includes('Firecrawl'));
      const scrapingLinks=/Monitored Data Sources|links? enabled|data scrap|scraping links|active monitored links/i.test(text);
      if(sourceBlock || scrapingLinks){
        if(el.id==='aiRecommendations' || el.querySelector?.('#aiRecommendations'))return;
        el.remove();
      }
    });
  }
}

function installWinturboDeclutter(){
  winturboFinalDeclutter();
  ['verification','contentIdeas','quality'].forEach(id=>{
    const sec=document.getElementById(id);
    if(!sec || sec.dataset.v18Observed)return;
    sec.dataset.v18Observed='1';
    const mo=new MutationObserver(()=>winturboFinalDeclutter());
    mo.observe(sec,{childList:true,subtree:true});
  });
  document.querySelectorAll('.nav button[data-s]').forEach(btn=>{
    if(btn.dataset.v18Bound)return;
    btn.dataset.v18Bound='1';
    btn.addEventListener('click',()=>setTimeout(winturboFinalDeclutter,0));
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installWinturboDeclutter);
else installWinturboDeclutter();
/* WINTURBO_FINAL_DECLUTTER_V18_END */
'''

sm='/* WINTURBO_FINAL_DECLUTTER_V18_START */'; em='/* WINTURBO_FINAL_DECLUTTER_V18_END */'
while sm in s and em in s:
    a=s.find(sm); b=s.find(em,a)
    if b<0: break
    s=s[:a]+s[b+len(em):]

idx=s.rfind('</script>')
if idx==-1:
    raise SystemExit('No script closing tag found')
s=s[:idx]+js+'\n'+s[idx:]

p.write_text(s)
print('final declutter installed for quality verification and content ideas')
