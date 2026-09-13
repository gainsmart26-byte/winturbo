from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text()

# Remove the Monitored Data Sources card only from Data Quality & AI.
start=s.find('<section id="quality"')
if start!=-1:
    end=s.find('</section>',start)
    if end!=-1:
        q=s[start:end]
        # Match the complete card containing the heading, using neighboring card boundaries.
        pat=re.compile(r'<div class="card"[^>]*>(?:(?!<div class="card").)*?Monitored Data Sources.*?</div>\s*</div>',re.S|re.I)
        q2,n=pat.subn('',q,count=1)
        if n==0:
            # Fallback: remove nearest card wrapper around the heading.
            pos=q.lower().find('monitored data sources')
            if pos!=-1:
                a=q.rfind('<div class="card"',0,pos)
                b=q.find('<div class="card"',pos)
                if a!=-1:
                    if b==-1: b=len(q)
                    q2=q[:a]+q[b:]
        s=s[:start]+q2+s[end:]

p.write_text(s)
print('removed Monitored Data Sources from Data Quality & AI')
