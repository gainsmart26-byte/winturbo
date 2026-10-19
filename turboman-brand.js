(()=>{
  const promise='TurboMan is here 24×7 to answer all WinTurbo queries. Control public access, approved knowledge, languages, handoffs and conversations.';
  function brand(){
    const launch=document.getElementById('tmLaunch');
    if(launch&&launch.textContent!=='⚡ Ask TurboMan · 24×7')launch.textContent='⚡ Ask TurboMan · 24×7';
    const head=document.querySelector('.tm-head');
    if(head&&!head.dataset.turboBranded){
      const old=head.querySelector('.tm-avatar');
      if(old?.tagName!=='IMG'){
        const img=document.createElement('img');img.className='tm-avatar';img.src='./turboman-icon.svg';img.alt='TurboMan';old?.replaceWith(img);
      }
      const small=head.querySelector('small');if(small)small.textContent='Here 24×7 · Multilingual support';
      head.dataset.turboBranded='true';
    }
    const hero=document.querySelector('#turbomanIntelligence .adminHero');
    if(hero&&!hero.dataset.turboBranded){
      const title=hero.querySelector('h2');
      if(title&&!title.querySelector('img'))title.insertAdjacentHTML('afterbegin','<img src="./turboman-icon.svg" class="tm-brand-avatar" alt="">');
      const intro=hero.querySelector('p');if(intro&&intro.textContent!==promise)intro.textContent=promise;
      hero.dataset.turboBranded='true';
    }
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(brand));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',brand,{once:true});else brand();
  if(!document.querySelector('link[data-telegram-intell]')){
    const style=document.createElement('link');style.rel='stylesheet';style.href='./telegram-intell.css';style.dataset.telegramIntell='true';document.head.appendChild(style);
  }
  if(!document.querySelector('script[data-telegram-intell]')){
    const script=document.createElement('script');script.src='./telegram-intell.js';script.defer=true;script.dataset.telegramIntell='true';document.head.appendChild(script);
  }
})();
