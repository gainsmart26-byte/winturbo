from pathlib import Path

p=Path('dashboard.html')
s=p.read_text()

# Repair malformed Image Engine markup introduced by v12.
bad='''<div style="margin-top:12px"><div class="k">Image Engine</div><select id="imageEngine"><option value="openai">ChatGPT / OpenAI Image</option><option value="higgsfield">Higgsfield Image</option></select><div id="imageEngineHelp" class="subv">Used for Image Post generation and as the source image for Video / Reel generation.</div>'''
good=bad+'''</div>'''
if bad in s and good not in s:
    s=s.replace(bad,good,1)

# Prevent long text, URLs and status strings from spilling across cards in the final sections.
css='''
/* WINTURBO_FINAL_SECTIONS_LAYOUT_V14 */
#quality .card,#verification .card,#contentIdeas .card{min-width:0;overflow:hidden}
#quality .grid2,#quality .grid4,#verification .grid2,#verification .grid4,#contentIdeas .grid2,#contentIdeas .grid4{align-items:start}
#quality .card *,#verification .card *,#contentIdeas .card *{min-width:0}
#quality .subv,#quality .recLine,#quality .muted,#verification .subv,#verification .muted,#contentIdeas .subv,#contentIdeas .muted,#contentIdeas #readyPostCopy,#contentIdeas #readyPostMedia{overflow-wrap:anywhere;word-break:break-word}
#quality .v,#verification .v,#contentIdeas .v{max-width:100%;overflow-wrap:anywhere}
#contentIdeas textarea{resize:vertical;line-height:1.5}
#contentIdeas #readyPostCopy{max-height:420px;overflow:auto}
#contentIdeas #readyPostMedia{overflow:hidden}
#contentIdeas #readyPostMedia img,#contentIdeas #readyPostMedia video,#contentIdeas #higgsfieldPreview img,#contentIdeas #higgsfieldPreview video{display:block;width:100%;height:auto;max-width:100%}
#verification .sectionHead,#contentIdeas .sectionHead,#quality .sectionHead{flex-wrap:wrap;align-items:flex-start}
@media(max-width:1200px){#quality .grid4{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:850px){#quality .grid4,#quality .grid2,#verification .grid2,#contentIdeas .grid2{grid-template-columns:1fr}}
'''
if 'WINTURBO_FINAL_SECTIONS_LAYOUT_V14' not in s:
    s=s.replace('</style>',css+'\n</style>',1)

p.write_text(s)
print('repaired final three dashboard section layout')
