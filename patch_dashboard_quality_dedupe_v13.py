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

prefix=s[:start]
segment=s[start:end]
suffix=s[end:]

canonical='''<div id="qualityEvidenceSummary" class="grid4"><div class="card"><div class="k">Telegram Evidence</div><div class="v" style="font-size:18px">Public / Authorized</div><div class="subv">t.me pages with authenticated fallback where legitimately accessible</div></div><div class="card"><div class="k">Instagram Evidence</div><div class="v" style="font-size:18px">Apify</div><div class="subv">Public profile/post/reel observations when configured</div></div><div class="card"><div class="k">Web Evidence</div><div class="v" style="font-size:18px">Firecrawl / Apify</div><div class="subv">Public websites and landing pages</div></div><div class="card"><div class="k">AI Recommendation Output</div><div class="v" style="font-size:18px">Channel-Aware</div><div class="subv">Each idea shows analyzed source + recommended publishing channel</div></div></div>'''

# Remove any previously canonicalized evidence summary.
segment=re.sub(r'<div id="qualityEvidenceSummary" class="grid4">.*?</div></div>', '', segment, flags=re.S)

# Remove complete legacy evidence cards exactly and safely. Avoid broad nested-div regexes.
legacy_cards=[
'''<div class="card"><div class="k">Telegram Evidence</div><div class="v" style="font-size:18px">Public / Authorized</div><div class="subv">t.me pages with authenticated fallback where legitimately accessible</div></div>''',
'''<div class="card"><div class="k">Instagram Evidence</div><div class="v" style="font-size:18px">Apify</div><div class="subv">Public profile/post/reel observations when configured</div></div>''',
'''<div class="card"><div class="k">Web Evidence</div><div class="v" style="font-size:18px">Firecrawl / Apify</div><div class="subv">Public websites and landing pages</div></div>''',
'''<div class="card"><div class="k">AI Recommendation Output</div><div class="v" style="font-size:18px">Channel-Aware</div><div class="subv">Each idea shows analyzed source + recommended publishing channel</div></div>'''
]
for card in legacy_cards:
    segment=segment.replace(card,'')

# Remove empty grid wrappers left by repeated prior builds.
segment=re.sub(r'<div class="grid4">\s*</div>', '', segment)

# Remove orphaned evidence text/tags created by the old unsafe regex cleanup.
orphans=[
'Telegram Evidence','Public / Authorized','t.me pages with authenticated fallback where legitimately accessible',
'Instagram Evidence','Apify','Public profile/post/reel observations when configured',
'Web Evidence','Firecrawl / Apify','Public websites and landing pages',
'AI Recommendation Output','Channel-Aware','Each idea shows analyzed source + recommended publishing channel'
]
for text in orphans:
    # Remove the phrase when it is wrapped in the small evidence divs.
    segment=re.sub(r'<div class="(?:k|v|subv)"(?: style="[^"]*")?>\s*'+re.escape(text)+r'\s*</div>', '', segment)
    # Remove naked copies that were left directly in the DOM by earlier malformed cleanup.
    segment=segment.replace(text,'')

# Clean now-empty wrappers once more.
segment=re.sub(r'<div class="card">\s*</div>', '', segment)
segment=re.sub(r'<div class="grid4">\s*</div>', '', segment)

# Insert exactly one clean summary immediately after the section opening tag.
opening='<section id="quality" class="section">'
segment=segment.replace(opening, opening+canonical, 1)

s=prefix+segment+suffix
p.write_text(s)
print('rebuilt Data Quality evidence summary with no orphan text')
