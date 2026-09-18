from pathlib import Path
p=Path('dashboard.html');s=p.read_text(encoding='utf-8')
MARK='WINTURBO_REPOST_V54'
if MARK in s: print('v54 already present'); raise SystemExit
js=r'''<script>/* WINTURBO_REPOST_V54 */
(function(){
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function repost(id,btn){
  if(!confirm('Re-post this published content to the same channel/account?'))return;
  const old=btn.textContent;btn.disabled=true;btn.textContent='Re-posting…';
  try{
   const r=await sb.rpc('repost_publishing_item',{p_queue_id:id});if(r.error)throw r.error;
   const q=Array.isArray(r.data)?r.data[0]:r.data;if(!q?.id)throw new Error('Re-post queue item was not created.');
   if(String(q.platform).toLowerCase()==='telegram'){
    const x=await sb.functions.invoke('publish-telegram',{body:{queue_id:q.id}});if(x.error)throw x.error;if(x.data?.ok===false)throw new Error(x.data.error||'Telegram re-post failed');
   }else throw new Error('Re-post is currently connected for Telegram only.');
   btn.textContent='Re-posted ✓';setTimeout(()=>{if(typeof hydrate==='function')hydrate();else location.reload()},700);
  }catch(e){alert(e.message||String(e));btn.disabled=false;btn.textContent=old;}
 }
 async function addButtons(){
  const host=document.getElementById('approvalPublishedCards');if(!host)return;
  const r=await sb.from('publishing_queue').select('id,published_url,platform,status,created_at').eq('status','published').order('published_at',{ascending:false});if(r.error)return;
  const rows=r.data||[],cards=[...host.querySelectorAll('.approvalCard')];
  cards.forEach((card,i)=>{if(card.querySelector('.repostQueueV54'))return;const q=rows[i];if(!q)return;let a=card.querySelector('.recActions');if(!a){a=document.createElement('div');a.className='recActions';card.appendChild(a)}const b=document.createElement('button');b.className='ghost repostQueueV54';b.textContent='Re-post Same Content';b.dataset.id=q.id;b.title='Creates a new publishing record and posts the same content to the same channel';b.onclick=()=>repost(q.id,b);a.appendChild(b)});
 }
 document.addEventListener('click',e=>{if(e.target.closest('button[data-s="approval"]'))setTimeout(addButtons,500)});
 new MutationObserver(()=>setTimeout(addButtons,50)).observe(document.documentElement,{childList:true,subtree:true});
 window.addEventListener('load',()=>setTimeout(addButtons,1000));
})();</script>'''
s=s.replace('</body>',js+'\n</body>',1)
p.write_text(s,encoding='utf-8')
print('Added safe Re-post Same Content action to published Approval cards.')
