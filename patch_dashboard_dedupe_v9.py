from pathlib import Path
import re

p = Path('dashboard.html')
s = p.read_text()

# Keep only one nav button for each of the two new workspaces.
for section_id, label in [('verification', '✓ Verification'), ('contentIdeas', '✦ Content Ideas')]:
    pat = re.compile(r'<button data-s="' + re.escape(section_id) + r'">.*?</button>')
    matches = list(pat.finditer(s))
    for m in reversed(matches[1:]):
        s = s[:m.start()] + s[m.end():]

# Keep only the LAST copy of each section. The latest copy contains the direct Higgsfield integration.
def keep_last_section(html, section_id):
    marker = f'<section id="{section_id}" class="section">'
    starts = []
    pos = 0
    while True:
        i = html.find(marker, pos)
        if i < 0:
            break
        starts.append(i)
        pos = i + len(marker)
    if len(starts) <= 1:
        return html
    # Remove older copies from right to left so indexes stay stable.
    for start in reversed(starts[:-1]):
        end = html.find('</section>', start)
        if end >= 0:
            html = html[:start] + html[end + len('</section>'):]
    return html

s = keep_last_section(s, 'verification')
s = keep_last_section(s, 'contentIdeas')

# The v7 patch used to be applied on top of an already-generated dashboard, which caused duplicate
# JS handlers on repeated workflow runs. Remove duplicate contiguous function blocks by keeping the
# last occurrence for the Content Ideas core functions.
def keep_last_function(html, name):
    token = f'async function {name}(' if f'async function {name}(' in html else f'function {name}('
    starts = []
    pos = 0
    while True:
        i = html.find(token, pos)
        if i < 0:
            break
        starts.append(i)
        pos = i + len(token)
    if len(starts) <= 1:
        return html
    # Balanced-brace scan for each older function.
    for start in reversed(starts[:-1]):
        brace = html.find('{', start)
        if brace < 0:
            continue
        depth = 0
        quote = None
        esc = False
        i = brace
        while i < len(html):
            ch = html[i]
            if quote:
                if esc:
                    esc = False
                elif ch == '\\':
                    esc = True
                elif ch == quote:
                    quote = None
            else:
                if ch in ('\"', "'", '`'):
                    quote = ch
                elif ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        html = html[:start] + html[i+1:]
                        break
            i += 1
    return html

for fn in ['generateContentIdea', 'buildIdeaMediaPrompt', 'openIdeaHiggsfield', 'publishIdeaTelegram']:
    s = keep_last_function(s, fn)

p.write_text(s)
print('deduped Verification and Content Ideas sections')
