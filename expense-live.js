/* WinTurbo Expense Sheet live sync */
(() => {
  const INTERVAL_MS=10000;
  let syncing=false,nextSyncAt=0,lastResult=null;

  const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const expenseVisible=()=>Array.from(document.querySelectorAll('main.main > section#expense')).some(s=>s.classList.contains("on")&&getComputedStyle(s).display!=="none");

  function badge(){
    let el=document.getElementById("expenseLiveSyncStatus");
    if(el)return el;
    const host=document.querySelector("#expense .sectionHead")||document.querySelector("#expense");
    if(!host)return null;
    el=document.createElement("span");el.id="expenseLiveSyncStatus";el.className="pill";el.textContent="LIVE · 10s";host.appendChild(el);return el;
  }

  async function render(){
    const {data,error}=await sb.from("expenses").select("*").order("source_row",{ascending:true});
    if(error)throw error;
    const rows=data||[],total=rows.reduce((a,r)=>a+Number(r.amount||0),0),by={};
    rows.forEach(r=>{const k=String(r.category||"").trim()||"Uncategorised";by[k]=(by[k]||0)+Number(r.amount||0)});
    const cats=Object.entries(by).sort((a,b)=>b[1]-a[1]),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set("expenseTotalV52",money(total));set("expenseCountV52",rows.length);set("expenseLargestCatV52",cats[0]?.[0]||"—");set("expenseLargestAmtV52",money(cats[0]?.[1]||0));
    const latest=rows.map(r=>r.synced_at).filter(Boolean).sort().at(-1);set("expenseSyncV52",latest?new Date(latest).toLocaleString("en-IN"):"—");
    const tb=document.getElementById("expenseSheetRowsV52");if(tb)tb.innerHTML=rows.map(r=>`<tr><td>${esc(r.expense_type)}</td><td><b>${money(r.amount)}</b></td><td>${esc(r.purpose)}</td></tr>`).join("")||'<tr><td colspan="3" class="muted">No expense data</td></tr>';
    const catsEl=document.getElementById("expenseCategoriesV52");
    if(catsEl){
      catsEl.style.cssText="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px";
      catsEl.setAttribute("aria-live","polite");
      const colors=["#4ade80","#60a5fa","#fbbf24","#c084fc","#fb923c","#22d3ee","#f472b6","#a3e635","#a5b4fc","#f87171","#2dd4bf","#e879f9","#facc15","#38bdf8"];
      const colorFor=k=>{let hash=0;for(const ch of k)hash=(hash*31+ch.charCodeAt(0))>>>0;return colors[hash%colors.length]};
      catsEl.innerHTML=cats.map(([k,v])=>{const color=colorFor(k),count=rows.filter(r=>(String(r.category||"").trim()||"Uncategorised")===k).length;return `<article class="card" style="margin:0;min-width:0;border:1px solid ${color}66;border-top:4px solid ${color};background:linear-gradient(135deg,${color}18,transparent)"><div style="font-size:12px;font-weight:800;overflow-wrap:anywhere">${esc(k)}</div><div style="font-size:26px;font-weight:900;color:${color};margin-top:8px;overflow-wrap:anywhere">${money(v)}</div><div class="muted small">${count} expense ${count===1?"entry":"entries"} · total so far</div></article>`}).join("")||'<div class="muted">No expense categories yet.</div>';
    }
  }

  async function sync(){
    if(syncing||!expenseVisible()||document.visibilityState!=="visible")return;
    syncing=true;const el=badge();if(el){el.textContent="SYNCING…";el.className="pill orange"}
    try{
      await render();
      const {data,error}=await sb.functions.invoke("sync-expenses",{body:{source:"expense-live-10s"}});
      if(error||data?.ok===false)throw new Error(data?.error||error?.message||"Sync failed");
      lastResult=data;await render();nextSyncAt=Date.now()+INTERVAL_MS;
      if(el){el.textContent="LIVE · UPDATED NOW";el.className="pill"}
      const report=document.getElementById("adminReportIntelligence");
      if(report?.classList.contains("on"))document.getElementById("reportApply")?.click();
    }catch(e){
      nextSyncAt=Date.now()+INTERVAL_MS;
      if(el){el.textContent="SYNC ERROR · RETRYING";el.className="pill red";el.title=e.message||String(e)}
    }finally{syncing=false}
  }

  function tick(){
    const el=badge();
    if(expenseVisible()&&document.visibilityState==="visible"){
      if(!nextSyncAt||Date.now()>=nextSyncAt)sync();
      else if(el&&!syncing){const seconds=Math.max(1,Math.ceil((nextSyncAt-Date.now())/1000));el.textContent=`LIVE · NEXT ${seconds}s`;el.className="pill"}
    }else if(el&&!syncing)el.textContent="LIVE · PAUSED";
  }

  document.addEventListener("click",e=>{if(e.target.closest('button[data-s="expense"]')){nextSyncAt=0;setTimeout(sync,150)}},true);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&expenseVisible()){nextSyncAt=0;sync()}});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{badge();setInterval(tick,1000)},{once:true});else{badge();setInterval(tick,1000)}
})();

/* Load the P&L Analysis module from the existing Expense bundle entrypoint. */
(() => {
  if(!document.querySelector('link[href="./pnl-analysis.css"]')){
    const style=document.createElement("link");style.rel="stylesheet";style.href="./pnl-analysis.css";document.head.appendChild(style);
  }
  if(!document.querySelector('script[src="./pnl-analysis.js"]')){
    const script=document.createElement("script");script.src="./pnl-analysis.js";script.defer=true;document.body.appendChild(script);
  }
})();
