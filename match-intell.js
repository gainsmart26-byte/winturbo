/* Read-only cricket fixtures from the existing WinTurbo event feed. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
let rows=[],busy=false,loaded=false,epoch=0,controller;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const dateLabel=value=>new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST';
function render(){
 const search=$('miSearch').value.trim().toLowerCase(),status=$('miFilter').value,now=Date.now();
 const visible=rows.filter(r=>(r.event_name+' '+(r.tournament_name||'')).toLowerCase().includes(search)&&(status==='all'||(status==='upcoming'?Date.parse(r.starts_at)>now:Date.parse(r.starts_at)<=now)));
 $('miCount').textContent=visible.length+' matching fixtures';
 $('miCards').innerHTML=[['Fixtures in loaded range',rows.length],['Scheduled in future',rows.filter(r=>Date.parse(r.starts_at)>now).length],['Started · result unavailable',rows.filter(r=>Date.parse(r.starts_at)<=now).length]].map(([label,count])=>`<article class="card"><span class="muted">${label}</span><h2>${count}</h2></article>`).join('');
 $('miRows').innerHTML=visible.length?visible.map(r=>`<tr><td><strong>${esc(r.event_name)}</strong><div class="muted">${esc(r.tournament_name||'Tournament unavailable')}</div></td><td>${esc(dateLabel(r.starts_at))}</td><td>${Date.parse(r.starts_at)>now?'Scheduled':'Started · status unverified'}</td><td>Unavailable</td><td>Unavailable</td><td>${esc(dateLabel(r.last_seen_at||r.starts_at))}</td></tr>`).join(''):'<tr><td colspan="6">No cricket fixtures match this selection.</td></tr>';
}
async function load(){
 if(busy)return;const from=$('miFrom').value,to=$('miTo').value;
 if(!from||!to||from>to){$('miStatus').textContent='Choose a valid date range.';return;}
 const start=Date.parse(from+'T00:00:00+05:30'),end=Date.parse(to+'T00:00:00+05:30')+86400000;
 if(end-start>366*86400000){$('miStatus').textContent='Choose up to 366 days per request.';return;}
 busy=true;const run=epoch;controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),20000);
 for(const id of ['miLoad','miFrom','miTo'])$(id).disabled=true;
 $('miStatus').textContent='Loading saved cricket fixtures…';
 try{
  const found=[];
  for(let offset=0;;offset+=500){
   const result=await sb.from('winturbo_events').select('id,event_name,tournament_name,starts_at,last_seen_at').ilike('sport_name','cricket').gte('starts_at',new Date(start).toISOString()).lt('starts_at',new Date(end).toISOString()).order('starts_at').order('id').range(offset,offset+499).abortSignal(controller.signal);
   if(result.error)throw result.error;if(run!==epoch)return;
   found.push(...(result.data||[]));if(!result.data||result.data.length<500)break;
  }
  rows=found;loaded=true;render();$('miStatus').textContent='Loaded '+rows.length+' saved fixtures · '+dateLabel(Date.now())+'. Refresh reads the saved event feed; it does not fetch live scores.';
 }catch(error){if(run===epoch)$('miStatus').textContent='Could not load fixtures. '+(controller?.signal.aborted?'Request timed out.':error.message||'Please retry.')+(loaded?' Previously loaded fixtures remain visible.':'');}
 finally{clearTimeout(timer);if(run===epoch){busy=false;for(const id of ['miLoad','miFrom','miTo'])if($(id))$(id).disabled=false;}}
}
function show(){if(!$('matchIntell'))return;document.querySelectorAll('#app main.main > section.section').forEach(s=>{const on=s.id==='matchIntell';s.classList.toggle('on',on);s.style.setProperty('display',on?'block':'none','important');s.setAttribute('aria-hidden',String(!on));});document.querySelectorAll('#app .nav button[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s==='matchIntell'));if($('title'))$('title').textContent='Match Intell';if(!loaded)load();}
async function boot(){
 const {user,profile}=await window.WinTurboLoadProfile();if(!user||profile?.role!=='admin'||!profile.is_active||$('matchIntell'))return;
 const main=document.querySelector('#app main.main'),nav=document.querySelector('#app .nav');if(!main||!nav)return;
 const section=document.createElement('section');section.id='matchIntell';section.className='section';section.style.setProperty('display','none','important');
 section.innerHTML=`<h2>Match Intell</h2><p class="muted">Cricket fixtures from WinTurbo Events. Times are shown in IST.</p><div class="card"><strong>Fixture feed only</strong><p>The current feed does not provide live scores, completed status, winners, losers, venue statistics, team form or head-to-head records. These require a verified cricket results feed. A passed start time does not confirm a match is live or completed. Coverage is limited to events collected by WinTurbo.</p></div><div class="card mi-controls"><label>From (IST)<input type="date" id="miFrom"></label><label>To (IST)<input type="date" id="miTo"></label><button id="miLoad">Refresh fixtures</button><label>Search<input id="miSearch" type="search" placeholder="Team or tournament"></label><label>Fixture status<select id="miFilter"><option value="all">All fixtures</option><option value="upcoming">Scheduled in future</option><option value="unknown">Started · result unavailable</option><option disabled>Live — feed required</option><option disabled>Completed — feed required</option></select></label></div><p id="miStatus" role="status" aria-live="polite">Open Match Intell to load fixtures.</p><div id="miCards" class="mi-cards"></div><div class="card"><p id="miCount"></p><div class="tableWrap"><table><thead><tr><th>Match / tournament</th><th>Scheduled start</th><th>Status</th><th>Score</th><th>Winner / loser</th><th>Last seen in feed</th></tr></thead><tbody id="miRows"></tbody></table></div></div>`;
 main.append(section);const navButton=document.createElement('button');navButton.dataset.s='matchIntell';navButton.textContent='Match Intell';nav.append(navButton);
 $('miFrom').value=day(Date.now()-30*86400000);$('miTo').value=day(Date.now()+30*86400000);$('miLoad').onclick=load;$('miSearch').oninput=render;$('miFilter').onchange=render;
 for(const id of ['miFrom','miTo'])$(id).onchange=()=>{$('miStatus').textContent='Dates changed. Click Refresh fixtures to load this range.';};render();
}
document.addEventListener('click',event=>{if(event.target.closest?.('[data-s="matchIntell"]')){event.preventDefault();event.stopImmediatePropagation();show();}},true);
if(typeof sb!=='undefined')sb.auth.onAuthStateChange?.(event=>{if(event==='SIGNED_OUT'){epoch++;controller?.abort();rows=[];busy=false;loaded=false;$('matchIntell')?.remove();document.querySelector('[data-s="matchIntell"]')?.remove();}});
window.WinTurboRegisterModule?.('matchIntell',boot);
})();
