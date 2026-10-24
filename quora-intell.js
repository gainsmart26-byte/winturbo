/* Quora research workspace. Posting is performed by the user on Quora. */
(() => {
  'use strict';
  const mount = () => {
    const nav = document.querySelector('#app .nav'), main = document.querySelector('main.main');
    if (!nav || !main || document.getElementById('quoraIntell')) return;
    const button = document.createElement('button'); button.dataset.s = 'quoraIntell'; button.textContent = '🔎 Quora Intell'; nav.append(button);
    const section = document.createElement('section'); section.id = 'quoraIntell'; section.className = 'section';
    section.innerHTML = `<style>
      #quoraIntell .qi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px;margin:20px 0}
      #quoraIntell .qi-stat{padding:22px;border-radius:18px;background:linear-gradient(135deg,#3730a3,#7c3aed);color:white;border:1px solid #a78bfa}
      #quoraIntell .qi-stat:nth-child(2){background:linear-gradient(135deg,#075985,#0891b2)}#quoraIntell .qi-stat:nth-child(3){background:linear-gradient(135deg,#065f46,#059669)}
      #quoraIntell .qi-stat strong{font-size:30px;display:block}#quoraIntell label{display:grid;gap:6px;margin:12px 0}#quoraIntell textarea{min-height:130px;width:100%;box-sizing:border-box}
      #quoraIntell .qi-tools{display:flex;gap:12px;flex-wrap:wrap;align-items:end}#quoraIntell .qi-tools label{flex:1;min-width:190px}#quoraIntell article{margin:14px 0;padding:20px;border:1px solid #64748b;border-radius:16px}#quoraIntell .qi-badge{background:#312e81;color:#e0e7ff;border-radius:12px;padding:5px 10px;display:inline-block}
    </style><h2>🔎 Quora Intell</h2><p class="muted">Find relevant discussions, prepare useful replies and track your work.</p>
    <p>Search opens Quora in a new tab. Sign in there using your own account. Add discussion links below to review them individually.</p>
    <div class="qi-tools"><label>Topic or keyword<input id="qiKeyword" maxlength="200" placeholder="Enter a topic"></label><button id="qiSearch" class="primary">Search Quora</button><a href="https://www.quora.com/" target="_blank" rel="noopener noreferrer">Open Quora / Sign in</a></div>
    <div id="qiStats" class="qi-grid"></div>
    <div class="card"><h3>Add a discussion</h3><label>Question / discussion title<input id="qiTitle" maxlength="500"></label><label>Quora discussion URL<input id="qiUrl" type="url" placeholder="https://www.quora.com/…"></label><button id="qiAdd" class="primary">Add discussion</button></div>
    <div class="card"><label>Your reply or message<textarea id="qiTemplate" maxlength="10000" placeholder="Write a useful answer to the specific question. Disclose your WinTurbo affiliation when relevant. Include an offer only when it is relevant and its terms are confirmed."></textarea></label><p class="muted">Use this text as a starting point, then edit each reply for its discussion.</p></div>
    <div class="qi-tools"><label>Status<select id="qiFilter"><option>All</option><option>To review</option><option>Draft ready</option><option>Posted manually</option><option>Skipped</option></select></label><button id="qiClear">Clear workspace</button></div>
    <p id="qiMessage" role="status" aria-live="polite"></p><div id="qiRows"></div><p class="muted">Workspace is held in this tab only and clears on reload. Posted status is self-reported. Search results and account connection are not imported or verified automatically.</p>`;
    main.append(section);
    const $ = id => document.getElementById(id); let rows = [];
    const message = text => { $('qiMessage').textContent = text; };
    function render() {
      $('qiStats').replaceChildren();
      for (const [label, count] of [['Saved discussions', rows.length], ['Draft ready', rows.filter(r=>r.status==='Draft ready').length], ['Posted manually', rows.filter(r=>r.status==='Posted manually').length]]) {
        const card=document.createElement('div'); card.className='qi-stat'; const n=document.createElement('strong');n.textContent=count;card.append(n,document.createTextNode(label));$('qiStats').append(card);
      }
      $('qiRows').replaceChildren();
      const visible=rows.filter(r=>$('qiFilter').value==='All'||r.status===$('qiFilter').value);
      if (!visible.length) $('qiRows').textContent='No discussions in this view. Search a topic and add a relevant discussion URL.';
      for (const row of visible) {
        const article=document.createElement('article'),title=document.createElement('h3'),link=document.createElement('a'),badge=document.createElement('span'),draft=document.createElement('textarea'),status=document.createElement('select');
        title.textContent=row.title;link.href=row.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open discussion on Quora';badge.className='qi-badge';badge.textContent=row.keyword||'Discussion';draft.value=row.draft;draft.maxLength=10000;draft.setAttribute('aria-label','Reply for '+row.title);draft.placeholder='Prepare a reply for this discussion';draft.oninput=()=>{row.draft=draft.value};
        for (const value of ['To review','Draft ready','Posted manually','Skipped']) status.add(new Option(value,value));status.value=row.status;status.setAttribute('aria-label','Status for '+row.title);status.onchange=()=>{row.status=status.value;render()};
        const use=document.createElement('button');use.textContent='Use message as draft';use.onclick=()=>{if(row.draft&&!confirm('Replace this discussion’s existing draft?'))return;row.draft=$('qiTemplate').value;render()};
        const copy=document.createElement('button');copy.textContent='Copy reply';copy.onclick=async()=>{try{if(!row.draft.trim())return message('Write a reply first.');await navigator.clipboard.writeText(row.draft);message('Reply copied. Review and post it yourself on Quora.')}catch{message('Clipboard unavailable. Select and copy the reply text manually.')}};
        const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=()=>{if(confirm('Remove this discussion and draft?')){rows=rows.filter(r=>r!==row);render()}};
        const tools=document.createElement('div');tools.className='qi-tools';tools.append(use,copy,status,remove);article.append(badge,title,link,draft,tools);$('qiRows').append(article);
      }
    }
    $('qiSearch').onclick=()=>{const q=$('qiKeyword').value.trim();if(!q)return message('Enter a topic or keyword.');window.open('https://www.quora.com/search?q='+encodeURIComponent(q),'_blank','noopener,noreferrer')};
    $('qiAdd').onclick=()=>{try{const url=new URL($('qiUrl').value.trim());if(url.protocol!=='https:'||!(url.hostname==='quora.com'||url.hostname==='www.quora.com')||url.username||url.password||url.pathname==='/')throw Error();url.hash='';url.search='';if(rows.some(r=>r.url===url.href))return message('This discussion is already saved.');const title=$('qiTitle').value.trim();if(!title)return message('Enter the discussion title.');rows.push({title,url:url.href,keyword:$('qiKeyword').value.trim(),draft:'',status:'To review'});$('qiTitle').value='';$('qiUrl').value='';render();message('Discussion added.')}catch{message('Enter a valid HTTPS Quora discussion URL.')}};
    $('qiFilter').onchange=render;$('qiClear').onclick=()=>{if(confirm('Clear all discussions and drafts in this tab?')){rows=[];render()}};render();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
