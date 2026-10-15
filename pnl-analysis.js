/* WinTurbo live P&L Analysis */
(() => {
  const $=id=>document.getElementById(id),INTERVAL=30000;
  let mounted=false,busy=false,nextSync=0,timer=null;
  const money=v=>v===null||v===undefined?"—":new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v));
  const num=v=>v===null||v===undefined?"—":new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(Number(v));
  const istDate=(d=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
  const visible=()=>$("pnlAnalysis")?.classList.contains("on")&&getComputedStyle($("pnlAnalysis")).display!=="none";
  const range=()=>({start:$("pnlFrom")?.value,end:$("pnlTo")?.value});

  function mount(){
    if(mounted||typeof sb==="undefined")return;
    const nav=document.querySelector("#app .nav"),main=document.querySelector("main.main");if(!nav||!main)return;
    const button=document.createElement("button");button.dataset.s="pnlAnalysis";button.textContent="▦ P&L Analysis";
    const expense=nav.querySelector('[data-s="expense"]');expense?expense.insertAdjacentElement("afterend",button):nav.appendChild(button);
    const section=document.createElement("section");section.id="pnlAnalysis";section.className="section";section.innerHTML=`
      <div class="pnlHero"><div><div class="adminEyebrow">LIVE FINANCIAL PERFORMANCE</div><h2>P&amp;L Analysis</h2><p>Deposits received − withdrawals given − total expenses.</p></div><div class="pnlActions"><span id="pnlSyncBadge" class="pill pnlSyncBadge">READY</span><button id="pnlSync" class="primary">Sync all data</button></div></div>
      <div class="card pnlDatePanel"><div class="pnlDateFields"><label>From date<input type="date" id="pnlFrom"></label><label>To date<input type="date" id="pnlTo"></label><button id="pnlApply" class="primary">Apply date range</button></div><div id="pnlStatus" class="muted small">Select a date range · Times shown in IST</div></div>
      <div class="pnlCards">
        <div class="card pnlCard pnlBlue"><div class="k">DEPOSITS RECEIVED</div><div id="pnlDeposits" class="v">—</div><div class="subv">Detected in selected range</div></div>
        <div class="card pnlCard pnlPurple"><div class="k">WITHDRAWALS GIVEN</div><div id="pnlWithdrawals" class="v">—</div><div id="pnlWithdrawalNote" class="subv">Awaiting withdrawal source</div></div>
        <div class="card pnlCard pnlOrange"><div class="k">TOTAL EXPENSES</div><div id="pnlExpenses" class="v">—</div><div class="subv">All Expense-tab categories</div></div>
        <div id="pnlNetCard" class="card pnlCard pnlRed"><div class="k">NET PROFIT / LOSS</div><div id="pnlNet" class="v">—</div><div id="pnlNetNote" class="subv">Awaiting withdrawal source</div></div>
        <div class="card pnlCard pnlYellow"><div class="k">COST PER FTD</div><div id="pnlCostFtd" class="v">—</div><div class="subv">Expenses ÷ FTD</div></div>
        <div class="card pnlCard pnlOrange"><div class="k">COST PER REGISTRATION</div><div id="pnlCostRegistration" class="v">—</div><div class="subv">Expenses ÷ registrations</div></div>
        <div class="card pnlCard pnlCyan"><div class="k">TOTAL REGISTRATIONS</div><div id="pnlRegistrations" class="v">—</div><div class="subv">Selected range</div></div>
        <div class="card pnlCard pnlGreen"><div class="k">TOTAL FTD</div><div id="pnlFtd" class="v">—</div><div class="subv">Selected range</div></div>
        <div class="card pnlCard pnlPink"><div class="k">AVERAGE DAILY FTD</div><div id="pnlAverageFtd" class="v">—</div><div class="subv">FTD ÷ selected days</div></div>
        <div class="card pnlCard pnlPurple"><div class="k">AVERAGE DAILY RETENTION</div><div id="pnlRetention" class="v">—</div><div id="pnlRetentionNote" class="subv">Repeat depositors in range</div></div>
      </div>
      <div class="pnlFormula"><b>Formula:</b> Deposits received − Withdrawals given − Total expenses = Net Profit/Loss. Profit appears green; loss appears red. Values remain blank when a required source is unavailable.</div>`;
    main.appendChild(section);mounted=true;
    const today=istDate();$("pnlFrom").value=today;$("pnlTo").value=today;
    button.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();open()};
    $("pnlApply").onclick=()=>load(false);$("pnlSync").onclick=()=>syncAll(true);
    timer=setInterval(tick,1000);
  }

  function open(){
    document.querySelectorAll("main.main > section.section").forEach(s=>{const on=s.id==="pnlAnalysis";s.classList.toggle("on",on);s.style.setProperty("display",on?"block":"none","important")});
    document.querySelectorAll("#app .nav button").forEach(b=>b.classList.toggle("on",b.dataset.s==="pnlAnalysis"));if($("title"))$("title").textContent="P&L Analysis";nextSync=0;syncAll(false);
  }

  async function load(fromSync){
    const r=range();if(!r.start||!r.end||r.end<r.start){$("pnlStatus").textContent="Select a valid date range.";return}
    const {data,error}=await sb.rpc("get_pnl_analysis",{p_start_date:r.start,p_end_date:r.end});if(error){$("pnlStatus").textContent=error.message;throw error}
    const t=data?.totals||{},available=data?.availability||{};
    $("pnlDeposits").textContent=money(t.deposits);$("pnlWithdrawals").textContent=money(t.withdrawals);$("pnlExpenses").textContent=money(t.expenses);
    $("pnlCostFtd").textContent=money(t.cost_per_ftd);$("pnlCostRegistration").textContent=money(t.cost_per_registration);$("pnlRegistrations").textContent=num(t.registrations);$("pnlFtd").textContent=num(t.ftd);$("pnlAverageFtd").textContent=num(t.average_daily_ftd);$("pnlRetention").textContent=t.average_daily_retention==null?"—":num(t.average_daily_retention)+"%";
    $("pnlWithdrawalNote").textContent=available.withdrawals?"Selected range":available.withdrawal_note||"Awaiting withdrawal source";
    const card=$("pnlNetCard"),net=t.net_profit_loss;$("pnlNet").textContent=money(net);card.classList.remove("pnlGreen","pnlRed");card.classList.add(net==null||Number(net)<0?"pnlRed":"pnlGreen");$("pnlNetNote").textContent=net==null?"Awaiting withdrawal source":Number(net)>=0?"Net profit":"Net loss";
    const generated=data?.generated_at?new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"medium"}).format(new Date(data.generated_at))+" IST":"now";
    $("pnlStatus").textContent=`${r.start} to ${r.end} · ${fromSync?"All sources synced":"Report refreshed"} ${generated}`;
  }

  async function syncAll(manual){
    if(busy||!visible())return;busy=true;const badge=$("pnlSyncBadge"),button=$("pnlSync");badge.textContent="SYNCING ALL SOURCES…";badge.className="pill orange pnlSyncBadge";button.disabled=true;
    const failures=[];
    try{
      const results=await Promise.allSettled([sb.functions.invoke("sync-expenses",{body:{source:"pnl-analysis"}}),sb.functions.invoke("sync-admin-players",{body:{source:"pnl-analysis"}})]);
      results.forEach((r,i)=>{if(r.status==="rejected"||r.value?.error||r.value?.data?.error)failures.push((i?"Admin":"Expense")+" sync")});
      await load(true);nextSync=Date.now()+INTERVAL;
      badge.textContent=failures.length?"PARTIAL SYNC":"LIVE · UPDATED NOW";badge.className="pill "+(failures.length?"orange":"green")+" pnlSyncBadge";badge.title=failures.length?failures.join(", ")+" failed; report uses latest saved data.":"";
    }catch(e){nextSync=Date.now()+INTERVAL;badge.textContent="SYNC ERROR · RETRYING";badge.className="pill red pnlSyncBadge";badge.title=e.message||String(e)}finally{busy=false;button.disabled=false}
  }

  function tick(){if(!mounted)return;if(!visible()||document.visibilityState!=="visible")return;if(!nextSync||Date.now()>=nextSync)syncAll(false);else if(!busy){const left=Math.max(1,Math.ceil((nextSync-Date.now())/1000));$("pnlSyncBadge").textContent=`LIVE · NEXT ${left}s`}}
  const start=()=>{mount();setTimeout(mount,700)};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
