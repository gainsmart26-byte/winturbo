from pathlib import Path
import re
p=Path('dashboard.html');s=p.read_text(encoding='utf-8')
# Keep Expense nav exactly once and immediately after Approval.
s=re.sub(r'\s*<button data-s="expense">Expense</button>','',s)
approval='<button data-s="approval">Approval</button>'
if approval in s:s=s.replace(approval,approval+'\n        <button data-s="expense">Expense</button>',1)
# Expense must never inherit/show Executive Overview content: replace the whole Expense section with a standalone section.
section='''<section class="section" id="expense">
  <div class="sectionHead"><div><h2 style="margin:0">Expense</h2><div class="muted">Expense data synced from Google Sheet</div></div><button class="ghost" id="refreshExpenseV52">Refresh</button></div>
  <div class="grid4">
    <div class="card"><div class="k">Total Expense</div><div class="v" id="expenseTotalV52">₹0</div></div>
    <div class="card"><div class="k">Expense Entries</div><div class="v" id="expenseCountV52">0</div></div>
    <div class="card"><div class="k">Largest Category</div><div class="v" style="font-size:20px" id="expenseLargestCatV52">—</div><div class="subv" id="expenseLargestAmtV52">₹0</div></div>
    <div class="card"><div class="k">Last Sync</div><div class="v" style="font-size:18px" id="expenseSyncV52">—</div></div>
  </div>
  <div class="grid2">
    <div class="card"><div class="k">Category Wise Expense</div><canvas id="expenseChartV52" style="margin-top:10px"></canvas></div>
    <div class="card"><div class="k">Google Sheet Columns</div><div class="tableWrap" style="margin-top:10px"><table><thead><tr><th>Expense Type</th><th>Amount</th><th>Purpose</th></tr></thead><tbody id="expenseSheetRowsV52"></tbody></table></div></div>
  </div>
  <div class="card" style="margin-top:13px"><div class="k">Category Totals</div><div id="expenseCategoriesV52" style="margin-top:10px"></div></div>
</section>'''
s=re.sub(r'<section class="section" id="expense">.*?</section>',section,s,count=1,flags=re.S)
# Remove old Expense runtime to prevent duplicate rendering/event behavior.
s=re.sub(r'<script>/\* WINTURBO_EXPENSE_V50 \*/.*?</script>','',s,count=1,flags=re.S)
js=r'''<script>/* WINTURBO_EXPENSE_LAYOUT_V52 */
(function(){
 const $=x=>document.getElementById(x);let chart=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 async function load(){
  const {data,error}=await sb.from('expenses').select('*').order('source_row',{ascending:true});if(error)return;
  const rows=data||[],total=rows.reduce((a,r)=>a+Number(r.amount||0),0),by={};
  rows.forEach(r=>{const k=r.purpose||r.category||'Uncategorised';by[k]=(by[k]||0)+Number(r.amount||0)});const cats=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  if($('expenseTotalV52'))$('expenseTotalV52').textContent=money(total);if($('expenseCountV52'))$('expenseCountV52').textContent=rows.length;
  if($('expenseLargestCatV52'))$('expenseLargestCatV52').textContent=cats[0]?.[0]||'—';if($('expenseLargestAmtV52'))$('expenseLargestAmtV52').textContent=money(cats[0]?.[1]||0);
  const sync=rows.map(r=>r.synced_at).filter(Boolean).sort().at(-1);if($('expenseSyncV52'))$('expenseSyncV52').textContent=sync?new Date(sync).toLocaleString('en-IN'):'—';
  if($('expenseSheetRowsV52'))$('expenseSheetRowsV52').innerHTML=rows.map(r=>`<tr><td>${esc(r.expense_type)}</td><td><b>${money(r.amount)}</b></td><td>${esc(r.purpose)}</td></tr>`).join('')||'<tr><td colspan="3" class="muted">No expense data</td></tr>';
  if($('expenseCategoriesV52'))$('expenseCategoriesV52').innerHTML=cats.map(([k,v])=>`<div class="sourceRow"><div><b>${esc(k)}</b></div><div style="font-weight:900">${money(v)}</div></div>`).join('');
  const c=$('expenseChartV52');if(c&&window.Chart){if(chart)chart.destroy();chart=new Chart(c,{type:'doughnut',data:{labels:cats.map(x=>x[0]),datasets:[{data:cats.map(x=>x[1])}]},options:{plugins:{legend:{position:'bottom'}}}})}
 }
 document.addEventListener('click',e=>{if(e.target?.dataset?.s==='expense'){document.querySelectorAll('main.main > section.section').forEach(sec=>{if(sec.id!=='expense'&&sec.classList.contains('on'))sec.classList.remove('on')});setTimeout(load,50)}if(e.target?.id==='refreshExpenseV52')load()});
 window.addEventListener('load',()=>setTimeout(load,800));
})();</script>'''
s=s.replace('</body>',js+'\n</body>',1)
p.write_text(s,encoding='utf-8')