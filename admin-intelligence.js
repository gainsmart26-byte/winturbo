/* WinTurbo Admin Intelligence */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = (v) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(v||0));
  const num = (v) => new Intl.NumberFormat("en-IN").format(Number(v||0));
  const when = (v) => v ? new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(new Date(v)) : "—";
  let page=0, lastRows=[], busy=false;

  function mount() {
    if ($("adminIntelligence")) return;
    const nav=document.querySelector("#app .nav"), main=document.querySelector("main.main");
    if(!nav||!main) return;
    const button=document.createElement("button");
    button.dataset.s="adminIntelligence";
    button.textContent="▦ Admin Intelligence";
    nav.appendChild(button);
    const section=document.createElement("section");
    section.id="adminIntelligence";
    section.className="section";
    section.innerHTML=`
      <div class="adminHero">
        <div><div class="adminEyebrow">PRIVATE OPERATIONS ANALYTICS</div><h2>Admin Intelligence</h2><p>Player, FTD, revenue, retention and agent performance from admin.winturbo.com.</p></div>
        <div class="adminHeroActions"><span id="adminSyncBadge" class="adminBadge">Not synced</span><button id="adminSync" class="primary">Sync now</button></div>
      </div>
      <div id="adminMessage" class="adminMessage"></div>
      <div class="adminMetrics">
        <div class="card"><div class="k">TOTAL PLAYERS</div><div id="admPlayers" class="v">—</div><div id="admActive" class="subv">— active</div></div>
        <div class="card"><div class="k">FTD PLAYERS</div><div id="admFtd" class="v">—</div><div id="admFtdRate" class="subv">— conversion</div></div>
        <div class="card"><div class="k">LIFETIME DEPOSITS</div><div id="admDeposits" class="v">—</div><div id="admToday" class="subv">— registrations today</div></div>
        <div class="card"><div class="k">NET GAMING REVENUE</div><div id="admNgr" class="v">—</div><div id="admGgr" class="subv">GGR —</div></div>
      </div>
      <div class="adminSegments">
        <button data-segment="all" class="on">All players <b id="segAll">—</b></button>
        <button data-segment="new">Registered today <b id="segNew">—</b></button>
        <button data-segment="ftd">FTD <b id="segFtd">—</b></button>
        <button data-segment="inactive">Inactive 30d <b id="segInactive">—</b></button>
        <button data-segment="high">High value <b id="segHigh">—</b></button>
        <button data-segment="negative">Negative GGR <b id="segNegative">—</b></button>
      </div>
      <div class="adminGrid">
        <div class="card"><div class="sectionHead"><div><h3>30-day acquisition</h3><div class="muted small">Registrations and first-time deposits</div></div></div><div id="adminTrend" class="adminTrend"></div></div>
        <div class="card"><div class="sectionHead"><div><h3>Agent performance</h3><div class="muted small">Ranked by net gaming revenue</div></div></div><div id="adminAgents" class="adminAgentList"></div></div>
      </div>
      <div class="card adminPlayersCard">
        <div class="sectionHead adminPlayerHead"><div><h3>Player databank</h3><div id="adminResultCount" class="muted small">Loading…</div></div>
          <div class="adminFilters"><input id="adminSearch" placeholder="Search username, phone or email"><select id="adminStatus"><option value="">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option></select><button id="adminExport" class="ghost">Export CSV</button></div>
        </div>
        <div class="tableWrap"><table class="adminTable"><thead><tr><th>Player</th><th>Status</th><th>Registered</th><th>FTD</th><th>Last deposit</th><th>Deposits</th><th>GGR</th><th>NGR</th><th>Agent / Upline</th></tr></thead><tbody id="adminPlayerRows"></tbody></table></div>
        <div class="adminPager"><button id="adminPrev" class="ghost">Previous</button><span id="adminPage">Page 1</span><button id="adminNext" class="ghost">Next</button></div>
      </div>`;
    main.appendChild(section);

    button.addEventListener("click",()=>open());
    $("adminSync").addEventListener("click",sync);
    $("adminStatus").addEventListener("change",()=>{page=0;loadPlayers()});
    let timer; $("adminSearch").addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(()=>{page=0;loadPlayers()},300)});
    document.querySelectorAll(".adminSegments button").forEach(b=>b.addEventListener("click",()=>{
      document.querySelectorAll(".adminSegments button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); page=0; loadPlayers();
    }));
    $("adminPrev").addEventListener("click",()=>{if(page>0){page--;loadPlayers()}});
    $("adminNext").addEventListener("click",()=>{page++;loadPlayers()});
    $("adminExport").addEventListener("click",exportCsv);
  }

  function open(){
    document.querySelectorAll("main.main > section.section").forEach(s=>{const on=s.id==="adminIntelligence";s.classList.toggle("on",on);s.style.setProperty("display",on?"block":"none","important")});
    document.querySelectorAll("#app .nav button").forEach(b=>b.classList.toggle("on",b.dataset.s==="adminIntelligence"));
    if($("title")) $("title").textContent="Admin Intelligence";
    loadAll();
  }

  async function loadAll(){
    await Promise.all([loadSummary(),loadPlayers(),loadState()]);
  }

  async function loadSummary(){
    const {data,error}=await sb.rpc("get_admin_intelligence_summary");
    if(error){message(error.message,true);return}
    const t=data?.totals||{};
    $("admPlayers").textContent=num(t.players); $("admActive").textContent=`${num(t.active)} active · ${num(t.blocked)} blocked`;
    $("admFtd").textContent=num(t.ftd); $("admFtdRate").textContent=`${t.ftd_rate||0}% conversion`;
    $("admDeposits").textContent=money(t.lifetime_deposits); $("admToday").textContent=`${num(t.registrations_today)} registrations · ${num(t.ftd_today)} FTD today`;
    $("admNgr").textContent=money(t.ngr); $("admGgr").textContent=`GGR ${money(t.ggr)}`;
    $("segAll").textContent=num(t.players); $("segNew").textContent=num(t.registrations_today); $("segFtd").textContent=num(t.ftd);
    $("segInactive").textContent=num(t.inactive_30d); $("segHigh").textContent=num(t.high_value); $("segNegative").textContent=num(t.negative_ggr);
    renderTrend(data?.trend||[]); renderAgents(data?.agents||[]);
  }

  function renderTrend(rows){
    const max=Math.max(1,...rows.flatMap(x=>[Number(x.registrations),Number(x.ftd)]));
    $("adminTrend").innerHTML=rows.map((x,i)=>`<div class="adminDay" title="${esc(x.date_value)} · ${x.registrations} registrations · ${x.ftd} FTD"><div class="adminBars"><i style="height:${Math.max(2,Number(x.registrations)/max*100)}%"></i><i style="height:${Math.max(2,Number(x.ftd)/max*100)}%"></i></div><span>${i%5===0?esc(String(x.date_value).slice(5)):""}</span></div>`).join("");
  }

  function renderAgents(rows){
    $("adminAgents").innerHTML=rows.length?rows.slice(0,12).map((x,i)=>`<div class="adminAgent"><b>#${i+1} ${esc(x.agent_name)}</b><span>${num(x.players)} players · ${x.ftd_rate||0}% FTD</span><strong>${money(x.ngr)}</strong></div>`).join(""):'<div class="muted">No agent data yet.</div>';
  }

  function query(){
    let q=sb.from("admin_players").select("*",{count:"exact"}).order("source_updated_at",{ascending:false});
    const search=$("adminSearch").value.trim(), status=$("adminStatus").value, segment=document.querySelector(".adminSegments button.on")?.dataset.segment||"all";
    if(search) q=q.or(`username.ilike.%${search.replace(/[%_,()]/g,"")}%,phone.ilike.%${search.replace(/[%_,()]/g,"")}%,email.ilike.%${search.replace(/[%_,()]/g,"")}%`);
    if(status) q=q.eq("status",status);
    const today=new Date(); today.setHours(0,0,0,0);
    if(segment==="new") q=q.gte("registered_at",today.toISOString());
    if(segment==="ftd") q=q.eq("ftd",true);
    if(segment==="inactive") q=q.or(`last_deposit_at.is.null,last_deposit_at.lt.${new Date(Date.now()-30*86400000).toISOString()}`);
    if(segment==="high") q=q.gte("lifetime_deposits",100000);
    if(segment==="negative") q=q.lt("ggr",0);
    return q;
  }

  async function loadPlayers(){
    const size=50, {data,error,count}=await query().range(page*size,page*size+size-1);
    if(error){message(error.message,true);return}
    if(page>0 && !data.length){page--;return loadPlayers()}
    lastRows=data||[]; $("adminResultCount").textContent=`${num(count)} matching players`; $("adminPage").textContent=`Page ${page+1}`;
    $("adminPrev").disabled=page===0; $("adminNext").disabled=(page+1)*size>=(count||0);
    $("adminPlayerRows").innerHTML=data.length?data.map(p=>`<tr><td><b>${esc(p.username)}</b><small>${esc(p.phone||"No phone")}<br>${esc(p.email||"No email")}</small></td><td><span class="adminStatus ${esc(p.status)}">${esc(p.status)}</span></td><td>${when(p.registered_at)}</td><td>${p.ftd?'<span class="adminYes">Yes</span><small>'+when(p.ftd_at)+'</small>':'No'}</td><td>${when(p.last_deposit_at)}</td><td><b>${money(p.lifetime_deposits)}</b></td><td class="${Number(p.ggr)<0?'adminNegative':''}">${money(p.ggr)}</td><td class="${Number(p.ngr)<0?'adminNegative':''}"><b>${money(p.ngr)}</b></td><td><b>${esc(p.agent?.username||"Unassigned")}</b><small>${esc((p.upline||[]).map(x=>x.username).join(" → ")||"—")}</small></td></tr>`).join(""):'<tr><td colspan="9" class="muted">No matching players.</td></tr>';
  }

  async function loadState(){
    const {data}=await sb.from("admin_player_sync_state").select("*").eq("id",true).maybeSingle();
    if(!data)return; const badge=$("adminSyncBadge"); badge.textContent=data.last_status==="success"?`Synced ${when(data.last_sync_completed_at)}`:data.last_status.replaceAll("_"," ");
    badge.className="adminBadge "+data.last_status;
    if(data.last_error) message(data.last_error,true);
  }

  async function sync(){
    if(busy)return; busy=true; $("adminSync").disabled=true; $("adminSync").textContent="Syncing…"; message("Securely syncing updated player records…");
    const {data,error}=await sb.functions.invoke("sync-admin-players",{body:{}});
    busy=false; $("adminSync").disabled=false; $("adminSync").textContent="Sync now";
    if(error||data?.error){message(data?.error||error.message,true);await loadState();return}
    message(`Sync complete: ${num(data.processed)} player records processed.`); await loadAll();
  }

  function message(text,isError=false){const el=$("adminMessage");if(!el)return;el.textContent=text||"";el.className="adminMessage "+(isError?"error":"");}

  function exportCsv(){
    if(!lastRows.length)return message("There are no visible rows to export.",true);
    const head=["Username","Phone","Email","Status","Registered At","FTD","FTD At","Last Deposit At","Lifetime Deposits","GGR","NGR","Agent","Upline"];
    const quote=v=>`"${String(v??"").replaceAll('"','""')}"`;
    const rows=lastRows.map(p=>[p.username,p.phone,p.email,p.status,p.registered_at,p.ftd,p.ftd_at,p.last_deposit_at,p.lifetime_deposits,p.ggr,p.ngr,p.agent?.username,(p.upline||[]).map(x=>x.username).join(" > ")]);
    const blob=new Blob([[head,...rows].map(r=>r.map(quote).join(",")).join("\n")],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`winturbo-players-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
  }

  async function boot(){
    const {data:{user}}=await sb.auth.getUser(); if(!user)return;
    const {data:profile}=await sb.from("profiles").select("role,is_active").eq("id",user.id).maybeSingle();
    if(profile?.role!=="admin"||!profile?.is_active)return;
    mount();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,700),{once:true});else setTimeout(boot,700);
  document.addEventListener("click",e=>{if(e.target.closest("#loginBtn"))setTimeout(boot,1200)});
})();