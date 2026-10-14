/* WinTurbo Admin Intelligence */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = (v) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(v||0));
  const num = (v) => new Intl.NumberFormat("en-IN").format(Number(v||0));
  const when = (v) => v ? new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(new Date(v)) : "—";
  const registrationDate = (v) => v ? new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(v)) : "—";
  const registrationTime = (v) => v ? new Intl.DateTimeFormat("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true,timeZone:"Asia/Kolkata"}).format(new Date(v))+" IST" : "—";
  let page=0, lastRows=[], busy=false, summaryRequest=0, accessMode="admin", notePlayer=null;
  const istDate=(value=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
  const range=()=>({start:$("adminDateFrom")?.value||istDate(),end:$("adminDateTo")?.value||istDate()});
  const rangeLabel=()=>{const r=range();return r.start===r.end?new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"}).format(new Date(r.start+"T12:00:00+05:30")):`${new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"}).format(new Date(r.start+"T12:00:00+05:30"))} – ${new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"}).format(new Date(r.end+"T12:00:00+05:30"))}`;};

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
      <div class="card adminDatePanel">
        <div class="adminDateFields">
          <label>From date<input type="date" id="adminDateFrom"></label>
          <label>To date<input type="date" id="adminDateTo"></label>
          <button id="adminApplyDates" class="primary">Apply date range</button>
        </div>
        <div class="adminDatePresets" aria-label="Quick date ranges">
          <button class="ghost" data-admin-range="today">Today</button>
          <button class="ghost" data-admin-range="yesterday">Yesterday</button>
          <button class="ghost" data-admin-range="week">This week</button>
          <button class="ghost" data-admin-range="month">This month</button>
        </div>
        <div id="adminRangeLabel" class="muted small">Showing Today · Times shown in IST</div>
      </div>
      <div class="adminMetrics">
        <div class="card"><div class="k">REGISTERED IN RANGE</div><div id="admPlayers" class="v">—</div><div id="admActive" class="subv">— total players</div></div>
        <div class="card"><div class="k">FTD IN RANGE</div><div id="admFtd" class="v">—</div><div id="admFtdRate" class="subv">— conversion</div></div>
        <div class="card"><div class="k">LIFETIME DEPOSITS</div><div id="admDeposits" class="v">—</div><div id="admToday" class="subv">— registrations today</div></div>
        <div class="card"><div class="k">NET GAMING REVENUE</div><div id="admNgr" class="v">—</div><div id="admGgr" class="subv">GGR —</div></div>
        <div class="card adminDailyDepositMetric"><div id="admDepositPeriodLabel" class="k">DEPOSITS RECEIVED</div><div id="admDailyDeposits" class="v">—</div><div id="admDailyDepositors" class="subv">— depositors</div></div>
        <div class="card"><div id="admRegPeriodLabel" class="k">REGISTERED VS FTD</div><div id="admRegVsFtd" class="v">—</div><div id="admTodayConversion" class="subv">— conversion</div></div>
      </div>
      <div class="adminSegments">
        <button data-segment="all" class="on">All players <b id="segAll">—</b></button>
        <button data-segment="new">Registered in range <b id="segNew">—</b></button>
        <button data-segment="nonftd">Non FTD <b id="segNonFtd">—</b></button><button data-segment="ftd">FTD <b id="segFtd">—</b></button>
        <button data-segment="inactive">Inactive 30d <b id="segInactive">—</b></button>
        <button data-segment="high">High value <b id="segHigh">—</b></button>
        <button data-segment="negative">Negative GGR <b id="segNegative">—</b></button>
      </div>
      <div class="adminGrid">
        <div class="card adminAcquisitionCard">
          <div class="sectionHead"><div><h3>Acquisition trend</h3><div class="muted small">Registrations, FTD conversion and detected deposits for the selected range</div></div><span id="adminTrendPeriod" class="pill">IST</span></div>
          <div id="adminTrendSummary" class="adminTrendSummary"></div>
          <div class="adminChartLegend"><span><i class="registrations"></i>Registrations</span><span><i class="ftd"></i>FTD</span><span><i class="deposits"></i>Deposits</span></div>
          <div id="adminTrendChart" class="adminTrendChart" aria-label="Acquisition trend chart"></div>
          <details class="adminTrendDetails"><summary>View complete day-by-day details</summary><div class="tableWrap"><table class="adminTable"><thead><tr><th>Date</th><th>Registrations</th><th>FTD</th><th>Conversion</th><th>Depositors</th><th>Deposits received</th></tr></thead><tbody id="adminTrendRows"></tbody></table></div></details>
        </div>
        <div class="card"><div class="sectionHead"><div><h3>Agent performance</h3><div class="muted small">Ranked by net gaming revenue</div></div></div><div id="adminAgents" class="adminAgentList"></div></div>
      </div>
      <div class="card adminTimeAnalysisCard">
        <div class="sectionHead"><div><h3>Time-slot performance analysis</h3><div class="muted small">High and low registration, FTD and deposit hours in IST for the selected date range.</div></div><span class="pill">24-HOUR ANALYSIS</span></div>
        <div id="adminTimeInsights" class="adminTimeInsights"></div>
        <div id="adminTimeCharts" class="adminTimeCharts"><div class="muted">Loading hourly analysis…</div></div>
      </div>
      <div class="card adminDailyDepositsCard">
        <div class="sectionHead"><div><h3>Deposits received</h3><div id="adminDepositRangeNote" class="muted small">Positive lifetime-deposit changes for the selected date range. Tracking begins from this feature's activation.</div></div><span class="pill">LIVE LEDGER</span></div>
        <div class="tableWrap"><table class="adminTable"><thead><tr><th>Username</th><th>Deposit received</th><th>Detected at</th><th>Lifetime total</th><th>Phone</th><th>Agent</th></tr></thead><tbody id="adminDailyDepositRows"></tbody></table></div>
      </div>
      <div class="card adminCommissionCard">
        <div class="sectionHead"><div><h3>Agent commission authorization</h3><div class="muted small">Authorize up to 50 agents and connect each dashboard user to their WinTurbo agent username.</div></div><span class="pill">50 AGENT SLOTS</span></div>
        <div class="adminCommissionForm">
          <label>Agent slot<select id="agentSlot"></select></label>
          <label>Agent name<input id="agentName" placeholder="Agent name"></label>
          <label>WinTurbo agent username<input id="agentUsername" placeholder="e.g. winturbo1"></label>
          <label>Dashboard user<select id="agentProfile"><option value="">No dashboard login</option></select></label>
          <label>Commission type<select id="agentCommissionType"><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label>
          <label>Commission value<input id="agentCommissionValue" type="number" min="0" step="0.01" value="0"></label>
          <label class="adminAgentCheck"><input id="agentAuthorized" type="checkbox"> Authorized</label>
          <button id="agentSave" class="primary">Save agent</button>
        </div>
        <div id="agentAuthorizationList" class="adminAgentAuthorizationList"></div>
      </div>
      <div class="card adminPlayersCard">
        <div class="sectionHead adminPlayerHead"><div><h3>Player databank</h3><div id="adminResultCount" class="muted small">Loading…</div></div>
          <div class="adminFilters"><input id="adminSearch" placeholder="Search username, phone or email"><select id="adminStatus"><option value="">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option></select><button id="adminExport" class="ghost">Export CSV</button></div>
        </div>
        <div class="tableWrap"><table class="adminTable"><thead><tr><th>Player</th><th>Status</th><th>Registered at (IST)</th><th>FTD</th><th>Last deposit</th><th>Deposits</th><th>GGR</th><th>NGR</th><th>Agent / Upline</th><th>Notes</th></tr></thead><tbody id="adminPlayerRows"></tbody></table></div>
        <div class="adminPager"><button id="adminPrev" class="ghost">Previous</button><span id="adminPage">Page 1</span><button id="adminNext" class="ghost">Next</button></div>
      </div>
      <div id="playerNotesModal" class="adminNotesModal" hidden><div class="adminNotesPanel"><div class="sectionHead"><div><h3 id="playerNotesTitle">Client notes</h3><div id="playerNotesMeta" class="muted small"></div></div><button id="playerNotesClose" class="ghost">Close</button></div><div id="playerNotesHistory" class="adminNotesHistory"></div><div class="adminNoteComposer"><select id="playerNoteType"><option value="general">General</option><option value="follow_up">Follow-up</option><option value="deposit">Deposit</option><option value="non_ftd">Non FTD</option><option value="payment">Payment</option></select><textarea id="playerNoteText" maxlength="2000" placeholder="Write a note for this client…"></textarea><button id="playerNoteSave" class="primary">Save note</button></div></div></div>`;
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
    $("playerNotesClose").addEventListener("click",closeNotes);
    $("playerNoteSave").addEventListener("click",saveNote);
    $("agentSave").addEventListener("click",saveAgent);
    $("agentSlot").innerHTML=Array.from({length:50},(_,i)=>`<option value="${i+1}">Agent ${i+1}</option>`).join("");
    $("agentSlot").addEventListener("change",fillAgentSlot);
    document.addEventListener("click",e=>{const b=e.target.closest(".adminNotesButton");if(b)openNotes(b.dataset.username)});
    if(accessMode==="agent") document.querySelectorAll(".adminHeroActions,.adminDatePanel,.adminMetrics,.adminSegments,.adminGrid,.adminDailyDepositsCard,.adminCommissionCard").forEach(x=>x.hidden=true);
    const today=istDate(); $("adminDateFrom").value=today; $("adminDateTo").value=today;
    $("adminApplyDates").addEventListener("click",applyRange);
    document.querySelectorAll("[data-admin-range]").forEach(b=>b.addEventListener("click",()=>setPreset(b.dataset.adminRange)));
  }

  function open(){
    document.querySelectorAll("main.main > section.section").forEach(s=>{const on=s.id==="adminIntelligence";s.classList.toggle("on",on);s.style.setProperty("display",on?"block":"none","important")});
    document.querySelectorAll("#app .nav button").forEach(b=>b.classList.toggle("on",b.dataset.s==="adminIntelligence"));
    if($("title")) $("title").textContent="Admin Intelligence";
    loadAll();
  }

  function setPreset(preset){
    const now=new Date(), end=istDate(now); let start=end;
    if(preset==="yesterday"){const d=new Date(now);d.setDate(d.getDate()-1);start=istDate(d);$("adminDateTo").value=start}
    else if(preset==="week"){const d=new Date(now);const weekday=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Kolkata",weekday:"short"}).format(d),day=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(weekday);d.setDate(d.getDate()-day);start=istDate(d);$("adminDateTo").value=end}
    else if(preset==="month"){start=end.slice(0,8)+"01";$("adminDateTo").value=end}
    else $("adminDateTo").value=end;
    $("adminDateFrom").value=start; applyRange();
  }

  function applyRange(){
    const r=range();
    if(!r.start||!r.end||r.end<r.start)return message("Select a valid From and To date.",true);
    const days=(new Date(r.end)-new Date(r.start))/86400000;
    if(days>366)return message("Date range cannot exceed 366 days.",true);
    page=0;
    $("adminRangeLabel").textContent=`Loading ${rangeLabel()}…`;
    message("Applying selected date range…");
    loadAll();
  }

  async function loadAll(){
    if(accessMode==="agent") return loadPlayers();
    await Promise.all([loadSummary(),loadPlayers(),loadState(),loadAgents(),loadTimeSlots()]);
  }

  async function loadSummary(){
    const request=++summaryRequest, r={...range()}, button=$("adminApplyDates");
    button.disabled=true; button.textContent="Loading…";
    const {data,error}=await sb.rpc("get_admin_intelligence_summary_range",{p_start_date:r.start,p_end_date:r.end});
    if(request!==summaryRequest)return;
    button.disabled=false; button.textContent="Apply date range";
    if(error){message(error.hint||error.message,true);return}
    const t=data?.totals||{}, label=rangeLabel();
    $("adminRangeLabel").textContent=`Showing ${label} · Times shown in IST`;
    $("admDepositPeriodLabel").textContent=`DEPOSITS RECEIVED · ${label}`;
    $("admRegPeriodLabel").textContent=`REGISTERED VS FTD · ${label}`;
    $("adminDepositRangeNote").textContent=`Positive lifetime-deposit changes detected from ${label}. Tracking begins from this feature's activation.`;
    $("admPlayers").textContent=num(t.registrations_today); $("admActive").textContent=`of ${num(t.players)} total players`;
    const selectedRate=Number(t.registrations_today)>0?(100*Number(t.ftd_today||0)/Number(t.registrations_today)).toFixed(1):"0.0";
    $("admFtd").textContent=num(t.ftd_today); $("admFtdRate").textContent=`${selectedRate}% selected-range ratio`;
    $("admDeposits").textContent=money(t.lifetime_deposits); $("admToday").textContent=`${num(t.registrations_today)} registrations · ${num(t.ftd_today)} FTD in range`;
    $("admNgr").textContent=money(t.ngr); $("admGgr").textContent=`GGR ${money(t.ggr)}`;
    $("admDailyDeposits").textContent=money(t.deposits_today); $("admDailyDepositors").textContent=`${num(t.depositors_today)} depositors · ${num(t.deposit_transactions_today)} detected deposits in range`;
    const todayRate=Number(t.registrations_today)>0?(100*Number(t.ftd_today||0)/Number(t.registrations_today)).toFixed(1):"0.0";
    $("admRegVsFtd").textContent=`${num(t.registrations_today)} / ${num(t.ftd_today)}`; $("admTodayConversion").textContent=`${todayRate}% same-day ratio`;
    $("segAll").textContent=num(t.registrations_today); $("segNew").textContent=num(t.registrations_today); $("segNonFtd").textContent=num(Math.max(0,Number(t.registrations_today||0)-Number(t.ftd_today||0))); $("segFtd").textContent=num(t.ftd_today);
    $("segInactive").textContent=num(t.inactive_30d); $("segHigh").textContent=num(t.high_value); $("segNegative").textContent=num(t.negative_ggr);
    renderTrend(data?.trend||[]); renderAgents(data?.agents||[]); renderDailyDeposits(data?.today_deposits||[]);
  }

  function renderTrend(rows){
    const summary=$("adminTrendSummary"), chart=$("adminTrendChart"), body=$("adminTrendRows");
    if(!rows.length){summary.innerHTML="";chart.innerHTML='<div class="muted">No acquisition data for this range.</div>';body.innerHTML="";return}
    const totalReg=rows.reduce((s,x)=>s+Number(x.registrations||0),0),totalFtd=rows.reduce((s,x)=>s+Number(x.ftd||0),0),totalDeposits=rows.reduce((s,x)=>s+Number(x.deposit_amount||0),0),totalDepositors=rows.reduce((s,x)=>s+Number(x.depositors||0),0),conversion=totalReg?100*totalFtd/totalReg:0;
    const best=rows.reduce((a,b)=>Number(b.ftd||0)>Number(a.ftd||0)||(Number(b.ftd||0)===Number(a.ftd||0)&&Number(b.registrations||0)>Number(a.registrations||0))?b:a,rows[0]);
    const shortDate=v=>new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short"}).format(new Date(v+"T12:00:00+05:30"));
    $("adminTrendPeriod").textContent=rangeLabel();
    summary.innerHTML=[
      ["Registrations",num(totalReg),"People registered"],
      ["FTD",num(totalFtd),conversion.toFixed(1)+"% conversion"],
      ["Deposits received",money(totalDeposits),num(totalDepositors)+" daily depositor counts"],
      ["Best acquisition day",shortDate(best.date_value),num(best.registrations)+" registered · "+num(best.ftd)+" FTD"]
    ].map(x=>`<div><span>${esc(x[0])}</span><b>${esc(x[1])}</b><small>${esc(x[2])}</small></div>`).join("");

    const width=Math.max(760,rows.length*64),maxCount=Math.max(1,...rows.flatMap(x=>[Number(x.registrations||0),Number(x.ftd||0)])),maxDeposit=Math.max(1,...rows.map(x=>Number(x.deposit_amount||0))),labelEvery=Math.max(1,Math.ceil(rows.length/12));
    chart.innerHTML=`<div class="adminBarChart" role="img" aria-label="Animated daily registration, FTD and deposit bars" style="min-width:${width}px">
      <div class="adminBarScale"><span>${num(maxCount)}</span><span>${num(Math.round(maxCount/2))}</span><span>0</span></div>
      <div class="adminBarPlot">
        <div class="adminBarGrid"><i></i><i></i><i></i><i></i><i></i></div>
        ${rows.map((r,i)=>{const reg=Number(r.registrations||0),ftd=Number(r.ftd||0),deposit=Number(r.deposit_amount||0),delay=Math.min(i*35,700);return`<div class="adminBarGroup" title="${shortDate(r.date_value)} · ${reg} registrations · ${ftd} FTD · ${money(deposit)} deposits">
          <div class="adminBarValues">
            <div class="adminAnimatedBar registrations" style="--bar-height:${Math.max(reg?4:0,reg/maxCount*100)}%;--bar-delay:${delay}ms"><em>${reg}</em></div>
            <div class="adminAnimatedBar ftd" style="--bar-height:${Math.max(ftd?4:0,ftd/maxCount*100)}%;--bar-delay:${delay+70}ms"><em>${ftd}</em></div>
            <div class="adminAnimatedBar deposits" style="--bar-height:${Math.max(deposit?4:0,deposit/maxDeposit*100)}%;--bar-delay:${delay+140}ms"><em>${deposit?money(deposit):"₹0"}</em></div>
          </div>
          <span class="adminBarDate">${i%labelEvery===0||i===rows.length-1?shortDate(r.date_value):""}</span>
        </div>`}).join("")}
      </div>
    </div>`;
    body.innerHTML=rows.slice().reverse().map(r=>{const rate=Number(r.registrations)>0?(100*Number(r.ftd||0)/Number(r.registrations)).toFixed(1):"0.0";return`<tr><td><b>${esc(shortDate(r.date_value))}</b></td><td>${num(r.registrations)}</td><td>${num(r.ftd)}</td><td><b>${rate}%</b></td><td>${num(r.depositors)}</td><td class="adminDepositAmount"><b>${money(r.deposit_amount)}</b></td></tr>`}).join("");
  }

  function renderAgents(rows){
    $("adminAgents").innerHTML=rows.length?rows.slice(0,12).map((x,i)=>`<div class="adminAgent"><b>#${i+1} ${esc(x.agent_name)}</b><span>${num(x.players)} players · ${x.ftd_rate||0}% FTD</span><strong>${money(x.ngr)}</strong></div>`).join(""):'<div class="muted">No agent data yet.</div>';
  }

  function renderDailyDeposits(rows){
    $("adminDailyDepositRows").innerHTML=rows.length?rows.map(x=>`<tr><td><b>${esc(x.username)}</b></td><td class="adminDepositAmount"><b>${money(x.amount)}</b></td><td>${when(x.detected_at)}</td><td>${money(x.lifetime_after)}</td><td>${esc(x.phone||"—")}</td><td>${esc(x.agent?.username||"Unassigned")}</td></tr>`).join(""):'<tr><td colspan="6" class="muted">No deposit increases were detected in the selected range. Press Sync now to check for updates.</td></tr>';
  }

  function query(){
    let q=sb.from("admin_players").select("*",{count:"exact"}).order("source_updated_at",{ascending:false});
    const search=$("adminSearch").value.trim(), status=$("adminStatus").value, segment=document.querySelector(".adminSegments button.on")?.dataset.segment||"all";
    const r=range(), startISO=new Date(r.start+"T00:00:00+05:30").toISOString(), endISO=new Date(new Date(r.end+"T00:00:00+05:30").getTime()+86400000).toISOString();
    if(accessMode!=="agent"){
      if(segment==="ftd") q=q.gte("ftd_at",startISO).lt("ftd_at",endISO);
      else q=q.gte("registered_at",startISO).lt("registered_at",endISO);
    }
    if(search) q=q.or(`username.ilike.%${search.replace(/[%_,()]/g,"")}%,phone.ilike.%${search.replace(/[%_,()]/g,"")}%,email.ilike.%${search.replace(/[%_,()]/g,"")}%`);
    if(status) q=q.eq("status",status);
    if(segment==="nonftd") q=q.eq("ftd",false);
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
    $("adminPlayerRows").innerHTML=data.length?data.map(p=>`<tr><td><b>${esc(p.username)}</b><small>${esc(p.phone||"No phone")}<br>${esc(p.email||"No email")}</small></td><td><span class="adminStatus ${esc(p.status)}">${esc(p.status)}</span></td><td class="adminRegisteredAt"><b>${registrationDate(p.registered_at)}</b><small>${registrationTime(p.registered_at)}</small></td><td>${p.ftd?'<span class="adminYes">Yes</span><small>'+when(p.ftd_at)+'</small>':'No'}</td><td>${when(p.last_deposit_at)}</td><td><b>${money(p.lifetime_deposits)}</b></td><td class="${Number(p.ggr)<0?'adminNegative':''}">${money(p.ggr)}</td><td class="${Number(p.ngr)<0?'adminNegative':''}"><b>${money(p.ngr)}</b></td><td><b>${esc(p.agent?.username||"Unassigned")}</b><small>${esc((p.upline||[]).map(x=>x.username).join(" → ")||"—")}</small></td><td><button class="mini adminNotesButton" data-username="${esc(p.username)}">Notes</button></td></tr>`).join(""):'<tr><td colspan="10" class="muted">No matching players.</td></tr>';
  }

  async function loadTimeSlots(){
    const r={...range()},{data,error}=await sb.rpc("get_admin_time_slot_analysis",{p_start_date:r.start,p_end_date:r.end});
    if(error){$("adminTimeCharts").innerHTML=`<div class="adminMessage error">${esc(error.hint||error.message)}</div>`;return}
    renderTimeSlots(data||[]);
  }
  function renderTimeSlots(rows){
    const metrics=[
      {key:"registrations",title:"Registrations",color:"green",format:v=>num(v)},
      {key:"ftd",title:"FTD",color:"orange",format:v=>num(v)},
      {key:"deposit_amount",title:"Deposits received",color:"blue",format:v=>money(v)}
    ];
    const active=rows.filter(r=>metrics.some(m=>Number(r[m.key]||0)>0));
    const insight=metrics.map(m=>{
      const peak=rows.reduce((a,b)=>Number(b[m.key]||0)>Number(a[m.key]||0)?b:a,rows[0]||{}),low=rows.reduce((a,b)=>Number(b[m.key]||0)<Number(a[m.key]||0)?b:a,rows[0]||{});
      return `<div class="${m.color}"><span>${m.title}</span><b>High: ${esc(peak.label||"—")}</b><small>${m.format(peak[m.key])} at peak · Low: ${esc(low.label||"—")} (${m.format(low[m.key])})</small></div>`;
    });
    $("adminTimeInsights").innerHTML=active.length?insight.join(""):'<div class="muted">No hourly activity exists for this selected range.</div>';
    $("adminTimeCharts").innerHTML=metrics.map(m=>{
      const max=Math.max(1,...rows.map(r=>Number(r[m.key]||0))),min=Math.min(...rows.map(r=>Number(r[m.key]||0))),peak=Math.max(...rows.map(r=>Number(r[m.key]||0)));
      return `<section class="adminHourMetric"><div class="adminHourMetricHead"><b>${m.title}</b><span>Hourly totals · IST</span></div><div class="adminHourBars">${rows.map((r,i)=>{const value=Number(r[m.key]||0),height=Math.max(value?5:1,value/max*100),state=value===peak&&peak>0?"peak":value===min?"low":"";return`<div class="adminHourSlot" title="${esc(r.label)} · ${m.title}: ${m.format(value)}"><div class="adminHourBarTrack"><i class="${m.color} ${state}" style="--hour-height:${height}%;--hour-delay:${Math.min(i*24,480)}ms"><em>${m.format(value)}</em></i></div><span>${i%3===0?esc(r.label):""}</span></div>`}).join("")}</div></section>`;
    }).join("");
  }

  let agentRows=[];
  async function loadAgents(){
    const [{data:rows,error},{data:profiles}]=await Promise.all([
      sb.from("admin_agent_commissions").select("*").order("slot_no"),
      sb.from("profiles").select("id,email,full_name,is_active").eq("is_active",true).order("full_name")
    ]);
    if(error)return message(error.message,true);
    agentRows=rows||[];
    $("agentProfile").innerHTML='<option value="">No dashboard login</option>'+(profiles||[]).map(p=>`<option value="${p.id}">${esc(p.full_name||p.email||p.id)}</option>`).join("");
    renderAgentsAuthorization(); fillAgentSlot();
  }
  function renderAgentsAuthorization(){
    $("agentAuthorizationList").innerHTML=agentRows.length?agentRows.map(a=>`<button type="button" class="adminAgentAuthRow ${a.is_authorized?"authorized":""}" data-slot="${a.slot_no}"><b>Agent ${a.slot_no} · ${esc(a.agent_name)}</b><span>@${esc(a.agent_username)} · ${a.commission_type==="percentage"?a.commission_value+"%":money(a.commission_value)}</span><em>${a.is_authorized?"Authorized":"Inactive"}</em></button>`).join(""):'<div class="muted">No agents configured yet. Choose a slot above to authorize the first agent.</div>';
    document.querySelectorAll(".adminAgentAuthRow").forEach(b=>b.onclick=()=>{$("agentSlot").value=b.dataset.slot;fillAgentSlot()});
  }
  function fillAgentSlot(){
    const slot=Number($("agentSlot").value),a=agentRows.find(x=>Number(x.slot_no)===slot);
    $("agentName").value=a?.agent_name||`Agent ${slot}`;
    $("agentUsername").value=a?.agent_username||"";
    $("agentProfile").value=a?.profile_id||"";
    $("agentCommissionType").value=a?.commission_type||"percentage";
    $("agentCommissionValue").value=a?.commission_value||0;
    $("agentAuthorized").checked=Boolean(a?.is_authorized);
  }
  async function saveAgent(){
    if(accessMode!=="admin")return;
    const slot=Number($("agentSlot").value),username=$("agentUsername").value.trim(),name=$("agentName").value.trim();
    if(!name||!username)return message("Enter the agent name and WinTurbo agent username.",true);
    const {data:{user}}=await sb.auth.getUser(),payload={slot_no:slot,agent_name:name,agent_username:username,profile_id:$("agentProfile").value||null,commission_type:$("agentCommissionType").value,commission_value:Number($("agentCommissionValue").value||0),is_authorized:$("agentAuthorized").checked,authorized_by:user.id,authorized_at:$("agentAuthorized").checked?new Date().toISOString():null,updated_at:new Date().toISOString()};
    $("agentSave").disabled=true;
    const {error}=await sb.from("admin_agent_commissions").upsert(payload,{onConflict:"slot_no"});
    $("agentSave").disabled=false;
    if(error)return message(error.message,true);
    message(`Agent ${slot} authorization saved.`);await loadAgents();
  }
  async function openNotes(username){
    notePlayer=lastRows.find(x=>x.username===username)||{username};
    $("playerNotesTitle").textContent=`Notes · ${username}`;
    $("playerNotesMeta").textContent=`${notePlayer.ftd?"Deposited / FTD":"Non FTD"} · ${notePlayer.phone||"No phone"} · Agent ${notePlayer.agent?.username||"Unassigned"}`;
    $("playerNotesModal").hidden=false;$("playerNoteText").value="";
    await loadNotes();
  }
  function closeNotes(){$("playerNotesModal").hidden=true;notePlayer=null}
  async function loadNotes(){
    const {data,error}=await sb.from("admin_player_notes").select("id,note_type,note_text,created_by,created_at").eq("username",notePlayer.username).order("created_at",{ascending:false});
    if(error)return $("playerNotesHistory").innerHTML=`<div class="adminMessage error">${esc(error.message)}</div>`;
    const ids=[...new Set((data||[]).map(x=>x.created_by))],profiles=ids.length?await sb.from("profiles").select("id,full_name,email").in("id",ids):{data:[]},names=new Map((profiles.data||[]).map(x=>[x.id,x.full_name||x.email]));
    $("playerNotesHistory").innerHTML=(data||[]).length?(data||[]).map(n=>`<article><div><span class="pill">${esc(n.note_type.replaceAll("_"," "))}</span><time>${when(n.created_at)}</time></div><p>${esc(n.note_text)}</p><small>By ${esc(names.get(n.created_by)||"Authorized agent")}</small></article>`).join(""):'<div class="muted">No notes yet. Add the first follow-up note below.</div>';
  }
  async function saveNote(){
    const text=$("playerNoteText").value.trim();if(!notePlayer||!text)return;
    const {data:{user}}=await sb.auth.getUser();$("playerNoteSave").disabled=true;
    const {error}=await sb.from("admin_player_notes").insert({username:notePlayer.username,note_type:$("playerNoteType").value,note_text:text,created_by:user.id});
    $("playerNoteSave").disabled=false;if(error)return alert(error.message);
    $("playerNoteText").value="";await loadNotes();
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

  let reportData=null;
  function mountReport(){
    if($("adminReportIntelligence"))return;
    const nav=document.querySelector("#app .nav"),main=document.querySelector("main.main");if(!nav||!main)return;
    const navButton=document.createElement("button");navButton.dataset.s="adminReportIntelligence";navButton.textContent="▥ Admin Report Intell";nav.appendChild(navButton);
    const section=document.createElement("section");section.id="adminReportIntelligence";section.className="section";section.innerHTML=`
      <div class="adminHero"><div><div class="adminEyebrow">PAID MEDIA UNIT ECONOMICS</div><h2>Admin Report Intelligence</h2><p>Facebook Ads and Google Ads spend measured against registrations, sign-ups and FTD performance. Defaults to the latest rolling 60 days.</p></div></div>
      <div class="card reportRange"><label>From<input type="date" id="reportFrom"></label><label>To<input type="date" id="reportTo"></label><button id="reportApply" class="primary">Apply range</button><span id="reportStatus" class="muted small"></span></div>
      <div class="reportTabs"><button data-report-tab="expenses" class="on">Expense ledger</button><button data-report-tab="performance">Performance analysis</button><button data-report-tab="projection">500 live depositors projection</button></div>
      <div id="reportExpenses" class="reportPane on">
        <div class="card"><div class="sectionHead"><div><h3>Advertising expense source</h3><div class="muted small">Automatically taken from the Expense tab. Only expense types Facebook Ads and Google Ads are included; no separate entry is required here.</div></div><span class="pill">EXPENSE TAB</span></div></div>
        <div class="card"><div class="sectionHead"><div><h3>Included advertising expenses</h3><div class="muted small">Filtered Facebook Ads and Google Ads entries recorded in the Expense tab for the selected range.</div></div></div><div class="tableWrap"><table class="adminTable"><thead><tr><th>Recorded date</th><th>Platform</th><th>Expense / purpose</th><th>Spend</th><th>Source</th><th>Imported</th></tr></thead><tbody id="reportExpenseRows"></tbody></table></div></div>
      </div>
      <div id="reportPerformance" class="reportPane"><div id="reportMetrics" class="reportMetrics"></div><div class="card"><div class="sectionHead"><div><h3>Daily spend vs acquisition</h3><div class="muted small">Existing expenses are cumulative through 14 Oct 2026; dated Sheet entries from 15 Oct onward are shown day by day.</div></div></div><div class="tableWrap"><table class="adminTable"><thead><tr><th>Date</th><th>Spend</th><th>Registrations / Sign-ups</th><th>FTD</th><th>Cost / Sign-up</th><th>Cost / FTD</th><th>Conversion</th></tr></thead><tbody id="reportDailyRows"></tbody></table></div></div></div>
      <div id="reportProjection" class="reportPane">
        <div class="card"><div class="sectionHead"><div><h3>500 daily live depositor projection</h3><div class="muted small">Uses the selected Admin Intelligence range's actual ad spend, registrations and FTD conversion to calculate the acquisition budget required.</div></div><span class="pill">TARGET: 500 / DAY</span></div>
          <div class="projectionBasis" id="projectionBasis"></div>
          <div class="reportProjectionInput">
            <label>FTD retention <output id="projectionRetentionValue">25%</output><input id="projectionRetention" type="range" min="1" max="60" step="1" value="25"></label>
            <label>Days to achieve target <output id="projectionHorizonValue">90 days</output><input id="projectionHorizon" type="range" min="30" max="365" step="1" value="90"></label>
            <label>Average deposit / depositor <output id="projectionDepositValue">₹1,750</output><input id="projectionAverageDeposit" type="range" min="1500" max="2000" step="50" value="1750"></label>
            <button id="projectionCalculate" class="primary">Recalculate</button>
          </div>
          <div id="projectionResults" class="projectionResults"></div>
          <div class="projectionBudgetBand" id="projectionBudgetBand"></div>
          <div class="tableWrap"><table class="adminTable"><thead><tr><th>Milestone</th><th>Daily budget</th><th>Weekly budget</th><th>Monthly budget</th><th>New FTD / day</th><th>Retained depositors / day</th><th>Live depositors / day</th></tr></thead><tbody id="projectionMilestones"></tbody></table></div>
          <div class="muted small reportCaveat"><b>Model:</b> On the target day, live depositors = that day's new FTDs + retained depositors from the preceding cohorts. Retention is applied once to each prior day's FTD cohort. Budget uses the selected Admin Intelligence period's blended cost per FTD. Average deposit changes projected deposit value, not acquisition cost. This is a planning estimate, not a guarantee.</div>
        </div>
      </div>`;
    main.appendChild(section);
    const today=istDate(),rollingStartDate=new Date(today+"T12:00:00+05:30");rollingStartDate.setDate(rollingStartDate.getDate()-59);const rollingStart=istDate(rollingStartDate);$("reportFrom").value=rollingStart;$("reportTo").value=today;
    navButton.onclick=()=>openReport();
    document.querySelectorAll("[data-report-tab]").forEach(b=>b.onclick=()=>showReportTab(b.dataset.reportTab));
    $("reportApply").onclick=loadReport;$("projectionCalculate").onclick=renderProjection;
    ["projectionRetention","projectionHorizon","projectionAverageDeposit"].forEach(id=>$(id).oninput=renderProjection);
  }
  function openReport(){
    document.querySelectorAll("main.main > section.section").forEach(s=>{const on=s.id==="adminReportIntelligence";s.classList.toggle("on",on);s.style.setProperty("display",on?"block":"none","important")});
    document.querySelectorAll("#app .nav button").forEach(b=>b.classList.toggle("on",b.dataset.s==="adminReportIntelligence"));if($("title"))$("title").textContent="Admin Report Intelligence";loadReport();
  }
  function showReportTab(name){
    document.querySelectorAll("[data-report-tab]").forEach(b=>b.classList.toggle("on",b.dataset.reportTab===name));
    ["expenses","performance","projection"].forEach(x=>$("report"+x[0].toUpperCase()+x.slice(1)).classList.toggle("on",x===name));
    if(name==="projection")renderProjection();
  }
  async function loadReport(){
    const start=$("reportFrom").value,end=$("reportTo").value;if(!start||!end||end<start)return $("reportStatus").textContent="Select a valid date range.";
    $("reportApply").disabled=true;$("reportApply").textContent="Loading…";
    const {data,error}=await sb.rpc("get_admin_report_intelligence",{p_start_date:start,p_end_date:end});
    $("reportApply").disabled=false;$("reportApply").textContent="Apply range";
    if(error)return $("reportStatus").textContent=error.message;
    reportData=data;$("reportStatus").textContent=`Showing ${start} to ${end} · Expense tab source · IST`;renderExpenses(data?.expenses||[]);renderReportPerformance();renderProjection();
  }
  function renderExpenses(rows){
    $("reportExpenseRows").innerHTML=rows.length?rows.map(x=>`<tr><td><b>${esc(x.expense_date)}</b></td><td><span class="pill ${x.platform==="facebook_ads"?"blue":"orange"}">${x.platform==="facebook_ads"?"Facebook Ads":"Google Ads"}</span></td><td>${esc(x.campaign_name||"—")}</td><td class="adminDepositAmount"><b>${money(x.amount)}</b></td><td>${esc(x.notes||"—")}</td><td>${when(x.created_at)}</td></tr>`).join(""):'<tr><td colspan="6" class="muted">No Facebook Ads or Google Ads entries were found in the Expense tab for this range.</td></tr>';
  }
  function renderReportPerformance(){
    if(!reportData)return;const t=reportData.totals||{};
    const metrics=[["Total ad spend",money(t.spend),`Facebook ${money(t.facebook_spend)} · Google ${money(t.google_spend)}`],["Registrations / sign-ups",num(t.registrations),`Cost per sign-up ${t.cost_per_registration==null?"—":money(t.cost_per_registration)}`],["FTD",num(t.ftd),`Cost per FTD ${t.cost_per_ftd==null?"—":money(t.cost_per_ftd)}`],["FTD conversion",(t.ftd_conversion||0)+"%",`${num(t.ftd)} FTD ÷ ${num(t.registrations)} registrations · Avg spend ${money(t.average_daily_spend)}/day`]];
    $("reportMetrics").innerHTML=metrics.map(x=>`<div class="card"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join("");
    $("reportDailyRows").innerHTML=(reportData.daily||[]).slice().reverse().map(d=>{const cpr=Number(d.registrations)?Number(d.spend)/Number(d.registrations):null,cpf=Number(d.ftd)?Number(d.spend)/Number(d.ftd):null,conv=Number(d.registrations)?100*Number(d.ftd)/Number(d.registrations):0;return`<tr><td><b>${esc(d.date_value)}</b></td><td>${money(d.spend)}</td><td>${num(d.registrations)}</td><td>${num(d.ftd)}</td><td>${cpr==null?"—":money(cpr)}</td><td>${cpf==null?"—":money(cpf)}</td><td>${conv.toFixed(1)}%</td></tr>`}).join("");
  }
  function renderProjection(){
    if(!reportData)return;
    const t=reportData.totals||{},cpr=Number(t.cost_per_registration||0),cpf=Number(t.cost_per_ftd||0),conversion=Number(t.ftd_conversion||0)/100;
    const retentionPct=Math.min(60,Math.max(1,Number($("projectionRetention").value||25))),retention=retentionPct/100;
    const days=Math.min(365,Math.max(30,Number($("projectionHorizon").value||90))),averageDeposit=Math.min(2000,Math.max(1500,Number($("projectionAverageDeposit").value||1750))),target=500;
    $("projectionRetentionValue").textContent=`${retentionPct}%`;$("projectionHorizonValue").textContent=`${days} days`;$("projectionDepositValue").textContent=money(averageDeposit);
    if(!cpr||!cpf||!conversion){
      $("projectionResults").innerHTML='<div class="adminMessage error">The selected range needs advertising spend, registrations and FTDs before a retained-player projection can be calculated.</div>';
      $("projectionBasis").innerHTML="";$("projectionBudgetBand").innerHTML="";
      $("projectionMilestones").innerHTML="";
      return;
    }
    const cohortFactor=1+retention*(days-1),requiredNewFtd=target/cohortFactor,requiredDailyRegs=requiredNewFtd/conversion;
    const requiredDailyBudget=requiredNewFtd*cpf,requiredWeeklyBudget=requiredDailyBudget*7,requiredMonthlyBudget=requiredDailyBudget*30,totalRampBudget=requiredDailyBudget*days;
    const retainedOnTarget=requiredNewFtd*retention*(days-1),dailyDepositValue=target*averageDeposit,monthlyDepositValue=dailyDepositValue*30;
    const rangeDays=Number(reportData.range?.days||0),rangeStart=reportData.range?.start_date||$("reportFrom").value,rangeEnd=reportData.range?.end_date||$("reportTo").value;
    $("projectionBasis").innerHTML=[
      ["Analysis window",`${rangeDays||"—"} days`,`${rangeStart} to ${rangeEnd}`],
      ["Observed ad spend",money(t.spend),`${money(t.average_daily_spend)}/day average`],
      ["Observed acquisition",`${num(t.registrations)} registrations · ${num(t.ftd)} FTD`,`${Number(t.ftd_conversion||0).toFixed(2)}% conversion`],
      ["Blended acquisition cost",money(cpf)+" / FTD",money(cpr)+" / registration"]
    ].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join("");
    $("projectionResults").innerHTML=[
      ["Target live depositors / day",num(target),`Achieved on day ${days}`],
      ["New FTD required / day",num(Math.ceil(requiredNewFtd)),`${num(Math.ceil(requiredDailyRegs))} registrations/day required`],
      ["Retained on target day",num(Math.floor(retainedOnTarget)),`${retentionPct}% from ${days-1} prior daily FTD cohorts`],
      ["Required daily ad budget",money(requiredDailyBudget),`Based on ${money(cpf)} blended cost / FTD`],
      ["Projected deposits / day",money(dailyDepositValue),`${num(target)} × ${money(averageDeposit)}`],
      ["Projected deposits / month",money(monthlyDepositValue),`30-day gross deposit volume at target`]
    ].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join("");
    $("projectionBudgetBand").innerHTML=`<div><span>Daily budget</span><b>${money(requiredDailyBudget)}</b></div><div><span>Weekly budget</span><b>${money(requiredWeeklyBudget)}</b></div><div><span>Monthly budget</span><b>${money(requiredMonthlyBudget)}</b></div><div><span>Total ${days}-day ramp budget</span><b>${money(totalRampBudget)}</b></div>`;
    const points=[...new Set([30,60,90,120,180,270,365,days].filter(x=>x<=days))].sort((a,b)=>a-b),milestones=points.map(elapsed=>{
      const retained=requiredNewFtd*retention*Math.max(0,elapsed-1),live=requiredNewFtd+retained;
      return `<tr><td><b>Day ${elapsed}${elapsed===days?" · target":""}</b></td><td>${money(requiredDailyBudget)}</td><td>${money(requiredWeeklyBudget)}</td><td>${money(requiredMonthlyBudget)}</td><td>${num(Math.ceil(requiredNewFtd))}</td><td>${num(Math.floor(retained))}</td><td><b>${num(Math.min(target,Math.floor(live)))}</b></td></tr>`;
    });
    $("projectionMilestones").innerHTML=milestones.join("");
  }

  async function boot(){
    const {data:{user}}=await sb.auth.getUser(); if(!user)return;
    const {data:profile}=await sb.from("profiles").select("role,is_active").eq("id",user.id).maybeSingle();
    if(!profile?.is_active)return;
    if(profile.role==="admin"){accessMode="admin";mountReport();}
    else {
      const {data:assignment}=await sb.from("admin_agent_commissions").select("id").eq("profile_id",user.id).eq("is_authorized",true).limit(1).maybeSingle();
      if(!assignment)return;
      accessMode="agent";
    }
    mount();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,700),{once:true});else setTimeout(boot,700);
  document.addEventListener("click",e=>{if(e.target.closest("#loginBtn"))setTimeout(boot,1200)});
})();
