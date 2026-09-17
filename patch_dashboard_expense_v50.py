from pathlib import Path
p=Path('dashboard.html');s=p.read_text(encoding='utf-8')
if 'WINTURBO_EXPENSE_V50' in s: raise SystemExit(0)
nav='''<button data-s="expense">Expense</button>'''
anchor='<button data-s="approval">Approval</button>'
if anchor in s: s=s.replace(anchor,anchor+'\n        '+nav,1)
else:
    nav_anchor='<div class="nav">'
    s=s.replace(nav_anchor,nav_anchor+'\n        '+nav,1)
section='''\n<section class="section" id="expense">\n  <div class="sectionHead"><div><h2 style="margin:0">Expense</h2><div class="muted">Synced from Google Sheet via Supabase</div></div><button class="ghost" id="refreshExpenseV50">Refresh</button></div>\n  <div class="grid4">\n    <div class="card"><div class="k">Total Expense</div><div class="v" id="expenseTotalV50">₹0</div></div>\n    <div class="card"><div class="k">Expense Entries</div><div class="v" id="expenseCountV50">0</div></div>\n    <div class="card"><div class="k">Largest Category</div><div class="v" style="font-size:20px" id="expenseLargestCatV50">—</div><div class="subv" id="expenseLargestAmtV50">₹0</div></div>\n    <div class="card"><div class="k">Last Sync</div><div class="v" style="font-size:18px" id="expenseSyncV50">—</div></div>\n  </div>\n  <div class="grid2">\n    <div class="card"><div class="k">Category Wise Expense</div><div id="expenseCategoriesV50" style="margin-top:10px"></div></div>\n    <div class="card"><div class="k">Expense Mix</div><canvas id="expenseChartV50"></canvas></div>\n  </div>\n  <div class="card" style="margin-top:13px"><div class="k">Expense Details</div><div class="tableWrap" style="margin-top:10px"><table><thead><tr><th>Expense Type</th><th>Category</th><th>Purpose</th><th>Amount</th><th>Source Row</th></tr></thead><tbody id="expenseRowsV50"></tbody></table></div></div>\n</section>\n'''
main_close='</main>'
s=s.replace(main_close,section+'\n'+main_close,1)
js=r'''<script>/* WINTURBO_EXPENSE_V50 */
(function(){
 const $=x=>document.getElementById(x); let chart=null;
 const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 async function loadExpense(){
   const q=await sb.from('expenses').select('*').order('source_row',{ascending:true});
   const rows=q.data||[];
   const total=rows.reduce((a,r)=>a+Number(r.amount||0),0);
   const by={}; rows.forEach(r=>{const k=r.category||r.purpose||'Uncategorised';by[k]=(by[k]||0)+Number(r.amount||0)});
   const cats=Object.entries(by).sort((a,b)=>b[1]-a[1]);
   if($('expenseTotalV50'))$('expenseTotalV50').textContent=money(total);
   if($('expenseCountV50'))$('expenseCountV50').textContent=rows.length;
   if($('expenseLargestCatV50'))$('expenseLargestCatV50').textContent=cats[0]?.[0]||'—';
   if($('expenseLargestAmtV50'))$('expenseLargestAmtV50').textContent=money(cats[0]?.[1]||0);
   const sync=rows.map(r=>r.synced_at).filter(Boolean).sort().at(-1); if($('expenseSyncV50'))$('expenseSyncV50').textContent=sync?new Date(sync).toLocaleString():'—';
   if($('expenseCategoriesV50'))$('expenseCategoriesV50').innerHTML=cats.map(([k,v])=>`<div class="sourceRow"><div><b>${k}</b></div><div style="font-weight:900">${money(v)}</div></div>`).join('')||'<div class="muted">No expense data</div>';
   if($('expenseRowsV50'))$('expenseRowsV50').innerHTML=rows.map(r=>`<tr><td>${r.expense_type||''}</td><td>${r.category||''}</td><td>${r.purpose||''}</td><td><b>${money(r.amount)}</b></td><td>${r.source_row||''}</td></tr>`).join('');
   const c=$('expenseChartV50'); if(c&&window.Chart){if(chart)chart.destroy();chart=new Chart(c,{type:'doughnut',data:{labels:cats.map(x=>x[0]),datasets:[{data:cats.map(x=>x[1])}]},options:{plugins:{legend:{position:'bottom'}}}})}
 }
 document.addEventListener('click',e=>{if(e.target?.dataset?.s==='expense')setTimeout(loadExpense,60);if(e.target?.id==='refreshExpenseV50')loadExpense()});
 window.addEventListener('load',()=>setTimeout(loadExpense,1000));
})();</script>'''
s=s.replace('</body>',js+'\n</body>',1)
p.write_text(s,encoding='utf-8')