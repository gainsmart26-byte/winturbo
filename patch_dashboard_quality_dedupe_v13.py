from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text()

start=s.find('<section id="quality" class="section">')
if start==-1:
    raise SystemExit('quality section not found')
end=s.find('</section>',start)
if end==-1:
    raise SystemExit('quality section end not found')

segment=s[start:end]
labels=['Telegram Evidence','Instagram Evidence','Web Evidence','AI Recommendation Output']

# Remove duplicate card blocks for these four evidence summaries, preserving the first copy.
for label in labels:
    matches=list(re.finditer(r'<div class="card">(?:(?!<div class="card">).)*?<div class="k">'+re.escape(label)+r'</div>.*?</div>',segment,re.S))
    for m in reversed(matches[1:]):
        segment=segment[:m.start()]+segment[m.end():]

# Also remove duplicate identical four-card evidence grids if older patches inserted the full block repeatedly.
grid_pat=re.compile(r'<div class="grid4">(?:(?!</div></div>).*?(?:Telegram Evidence|Instagram Evidence|Web Evidence|AI Recommendation Output).*?){4}?</div></div>',re.S)
grids=list(grid_pat.finditer(segment))
for m in reversed(grids[1:]):
    segment=segment[:m.start()]+segment[m.end():]

s=s[:start]+segment+s[end:]
p.write_text(s)
print('removed duplicate Data Quality evidence cards')
