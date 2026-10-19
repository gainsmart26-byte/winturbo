/* WinTurbo Telegram advertiser + channel intelligence */
(()=>{
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n=v=>Number(v||0),num=v=>new Intl.NumberFormat('en-IN').format(n(v)),dec=(v,d=2)=>n(v).toFixed(d);
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
 function mount(){
  if($('telegramIntell'))return;
  const nav=document.querySelector('#app .nav'),main=document.querySelector('#app main.main');if(!nav||!main)return;
  const b=document.createElement('button');b.dataset.s='telegramIntell';b.textContent='✈ Telegram Intell';const anchor=nav.querySelector('[data-s="trafficIntelligence"]');anchor?anchor.insertAdjacentElement('afterend',b):nav.appendChild(b);
  const s=document.createElement('section');s.id='telegramIntell';s.className='section';s.innerHTML=`
   <div class="tgintel-hero"><div><div class="k">ADVERTISING + CHANNEL PERFORMANCE</div><h2>Telegram Intell</h2><div class="muted">Telegram Ads spend and conversion intelligence combined with WinTurbo channel growth.</div></div><div class="tgintel-controls"><label>From<input id="tgIntelFrom" type="date"></label><label>To<input id="tgIntelTo" type="date"></label><label>Ads account<select id="tgIntelAccount"><option value="all">All accounts</option></select></label><button id="tgIntelApply" class="primary">Apply</button><button id="tgIntelRefresh" class="ghost">Refresh Data</button></div></div>
   <div id="tgIntelMessage" class="tgintel-sync"></div><div id="tgIntelKpis" class="tgintel-grid"></div>
   <div class="tgintel-layout"><div class="card"><div class="sectionHead"><div><h3>Daily spend and acquisition</h3><div class="muted small">Animated bars show Telegram Ads views; labels include spend and joined users.</div></div><span class="pill">GRAM</span></div><div id="tgIntelTrend" class="tgintel-bars"></div></div>
   <div class="card"><div class="sectionHead"><div><h3>Channel intelligence</h3><div class="muted small">Latest connected Telegram channel snapshots.</div></div></div><div id="tgIntelChannels"></div></div></div>
   <div class="card" style="margin-top:14px"><div class="sectionHead"><div><h3>Advertisement performance</h3><div class="muted small">Views, clicks, joins and efficiency for every connected Telegram ad.</div></div></div><div class="tgintel-table-wrap"><table class="tgintel-table"><thead><tr><th>Ad</th><th>Destination</th><th>Status</th><th>Views</th><th>Clicks</th><th>Joined</th><th>CTR</th><th>Join rate</th><th>CPM</th><th>Remaining</th></tr></thead><tbody id="tgIntelAds"></tbody></table></div></div>`;
  main.appendChild(s);b.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll('#app section.section').forEach(x=>{x.classList.remove('on');x.style.setProperty('display','none','important')});s.classList.add('on');s.style.setProperty('display','block','important');nav.querySelectorAll('button[data-s]').forEach(x=>x.classList.toggle('on',x===b));if($('title'))$('title').textContent='Telegram Intell';load()};
  const end=today(),start=new Date(Date.now()-29*86400000).toISOString().slice(0,10);$('tgIntelFrom').value=start;$('tgIntelTo').value=end;$('tgIntelApply').onclick=load;$('tgIntelRefresh').onclick=load;
 }
 async function load(){
  if(typeof sb==='undefined')return;const msg=$('tgIntelMessage'),btn=$('tgIntelRefresh');btn.disabled=true;btn.textContent='Refreshing…';msg.textContent='Loading connected Telegram Ads and channel data…';
  try{
   const from=$('tgIntelFrom').value,to=$('tgIntelTo').value,account=$('tgIntelAccount').value;
   const [accounts,ads,daily,channels]=await Promise.all([
    sb.from('telegram_ad_accounts').select('*').order('account_name'),
    sb.from('telegram_ads').select('*').order('views',{ascending:false}),
    sb.from('telegram_ad_daily').select('*,telegram_ads!inner(account_id,title)').gte('metric_date',from).lte('metric_date',to).order('metric_date'),
    sb.from('accounts').select('id,account_name,handle,followers_current,last_seen_at').eq('platform','telegram').order('followers_current',{ascending:false})
   ]);for(const r of [accounts,ads,daily,channels])if(r.error)throw r.error;
   const prev=$('tgIntelAccount').value,acc=accounts.data||[];$('tgIntelAccount').innerHTML='<option value="all">All accounts</option>'+acc.map(x=>`<option value="${x.id}">${esc(x.account_name)}</option>`).join('');$('tgIntelAccount').value=acc.some(x=>x.id===prev)?prev:'all';
   const selected=$('tgIntelAccount').value,adRows=(ads.data||[]).filter(x=>selected==='all'||x.account_id===selected),ids=new Set(adRows.map(x=>x.id)),days=(daily.data||[]).filter(x=>ids.has(x.ad_id));
   renderKpis(adRows,days,acc.filter(x=>selected==='all'||x.id===selected));renderTrend(days);renderAds(adRows);renderChannels(channels.data||[]);
   const last=acc.map(x=>x.last_synced_at).filter(Boolean).sort().pop();msg.textContent=`Connected advertiser account${acc.length===1?'':'s'}: ${acc.length} · Source: Telegram Ads · Last imported ${last?new Date(last).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'not available'}`;
  }catch(e){msg.textContent='Telegram Intell error: '+(e.message||e);$('tgIntelKpis').innerHTML='';}finally{btn.disabled=false;btn.textContent='Refresh Data'}
 }
 function renderKpis(ads,days,accounts){
  const views=days.reduce((a,x)=>a+n(x.views),0),clicks=days.reduce((a,x)=>a+n(x.clicks),0),joined=days.reduce((a,x)=>a+n(x.joined),0),spend=days.reduce((a,x)=>a+n(x.spend),0),balance=accounts.reduce((a,x)=>a+n(x.available_balance),0);
  const cards=[['Views',num(views),'blue'],['Clicks',num(clicks),'blue'],['Joined',num(joined),'green'],['Spend','💎 '+dec(spend),'orange'],['Cost / join',joined?'💎 '+dec(spend/joined):'—','green'],['Account balance','💎 '+dec(balance),'orange']];
  $('tgIntelKpis').innerHTML=cards.map(x=>`<div class="tgintel-kpi ${x[2]}"><div class="k">${x[0]}</div><div class="v">${x[1]}</div></div>`).join('');
 }
 function renderTrend(rows){
  const by={};rows.forEach(x=>{const d=x.metric_date;by[d]??={views:0,spend:0,joined:0};by[d].views+=n(x.views);by[d].spend+=n(x.spend);by[d].joined+=n(x.joined)});const vals=Object.entries(by),max=Math.max(1,...vals.map(x=>x[1].views));
  $('tgIntelTrend').innerHTML=vals.length?vals.map(([d,x])=>`<div class="tgintel-bar" title="${num(x.views)} views · 💎${dec(x.spend)} spend · ${num(x.joined)} joined"><div><i style="height:${Math.max(3,x.views/max*100)}%"></i></div><small>${d.slice(5)}<br>💎${dec(x.spend,1)} · +${x.joined}</small></div>`).join(''):'<div class="muted">No ad activity in this date range.</div>';
 }
 function renderAds(rows){$('tgIntelAds').innerHTML=rows.length?rows.map(x=>{const ctr=x.views?n(x.clicks)/n(x.views)*100:0,jr=x.clicks?n(x.joined)/n(x.clicks)*100:0;return `<tr><td><b>${esc(x.title)}</b><br><small class="muted">Ad #${esc(x.external_ad_id)}</small></td><td><a href="${esc(x.destination_url)}" target="_blank" rel="noopener">${esc(String(x.destination_url||'').replace('https://t.me/','@'))}</a></td><td class="tgintel-good">${esc(x.status)}</td><td>${num(x.views)}</td><td>${num(x.clicks)}</td><td>${num(x.joined)}</td><td>${dec(ctr)}%</td><td>${dec(jr)}%</td><td>💎 ${dec(x.cpm)}</td><td>💎 ${dec(x.remaining_budget)}</td></tr>`}).join(''):'<tr><td colspan="10" class="muted">No Telegram ads found.</td></tr>'}
 function renderChannels(rows){$('tgIntelChannels').innerHTML=rows.length?rows.map(x=>`<div class="tgintel-channel"><div><b>${esc(x.account_name||x.handle)}</b><small>@${esc(String(x.handle||'').replace(/^@/,''))}</small></div><div><b>${num(x.followers_current)}</b><small>Followers</small></div><div><b>${x.last_seen_at?new Date(x.last_seen_at).toLocaleDateString('en-IN'):'—'}</b><small>Last sync</small></div><a class="mini" href="https://t.me/${esc(String(x.handle||'').replace(/^@/,''))}" target="_blank" rel="noopener">Open</a></div>`).join(''):'<div class="muted">No Telegram channel snapshots are currently available.</div>'}
 function boot(){mount()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900),{once:true});else setTimeout(boot,900);document.addEventListener('click',e=>{if(e.target.closest('#loginBtn'))setTimeout(mount,1000)});
})();
