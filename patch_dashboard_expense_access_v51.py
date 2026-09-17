from pathlib import Path
import re
p=Path('dashboard.html');s=p.read_text(encoding='utf-8')
# v33 runtime is regenerated before this patch. Add Expense to its canonical section list.
old="['contentIdeas','Content Ideas'],['approval','Approval']"
new="['contentIdeas','Content Ideas'],['approval','Approval'],['expense','Expense']"
if old in s: s=s.replace(old,new,1)
# Safety: ensure Expense nav exists even if prior expense patch anchor changed.
if 'data-s=\"expense\"' not in s:
    m=re.search(r'(<div class=\"nav\"[^>]*>)(.*?)(</div>)',s,flags=re.S)
    if m:
        nav=m.group(1)+m.group(2)+'\n<button data-s=\"expense\">Expense</button>\n'+m.group(3)
        s=s[:m.start()]+nav+s[m.end():]
# Mark version for idempotency/diagnostics.
if 'WINTURBO_EXPENSE_ACCESS_V51' not in s:
    s=s.replace('</body>','<script>/* WINTURBO_EXPENSE_ACCESS_V51 */</script>\n</body>',1)
p.write_text(s,encoding='utf-8')