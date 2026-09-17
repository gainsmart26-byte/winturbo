from pathlib import Path
import re
p=Path('dashboard.html');s=p.read_text(encoding='utf-8')
# Remove any existing Expense nav buttons, then insert directly after the actual Approval nav button regardless of attributes/spacing.
s=re.sub(r'\s*<button\b[^>]*\bdata-s=["\']expense["\'][^>]*>\s*Expense\s*</button>','',s,flags=re.I)
pat=r'(<button\b[^>]*\bdata-s=["\']approval["\'][^>]*>.*?</button>)'
m=re.search(pat,s,flags=re.I|re.S)
if not m:
    raise SystemExit('Approval navigation button not found')
expense='\n        <button data-s="expense">Expense</button>'
s=s[:m.end()]+expense+s[m.end():]
# Ensure access registry knows Expense. Handle both quote styles/spacing by inserting before closing section array when possible.
if "['expense','Expense']" not in s and '["expense","Expense"]' not in s:
    s=s.replace("['approval','Approval']","['approval','Approval'],['expense','Expense']")
# Final runtime guard: admins/viewers should not lose the nav due to stale visibility code.
guard=r'''<script>/* WINTURBO_EXPENSE_NAV_V53 */
(function(){
 function ensureExpenseNav(){
  const approval=document.querySelector('button[data-s="approval"]');
  if(!approval)return;
  let expense=document.querySelector('button[data-s="expense"]');
  if(!expense){expense=document.createElement('button');expense.dataset.s='expense';expense.textContent='Expense';}
  if(approval.nextElementSibling!==expense)approval.insertAdjacentElement('afterend',expense);
  const role=(window.currentAccess?.access_level||window.dashboardAccess?.access_level||'').toLowerCase();
  if(role==='admin'||role==='view'||role==='view_only'||role==='viewer') expense.style.display='';
 }
 document.addEventListener('DOMContentLoaded',ensureExpenseNav);
 window.addEventListener('load',()=>{ensureExpenseNav();setTimeout(ensureExpenseNav,500);setTimeout(ensureExpenseNav,1500)});
 new MutationObserver(()=>ensureExpenseNav()).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
})();</script>'''
if 'WINTURBO_EXPENSE_NAV_V53' not in s:s=s.replace('</body>',guard+'\n</body>',1)
p.write_text(s,encoding='utf-8')