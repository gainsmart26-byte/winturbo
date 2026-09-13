from pathlib import Path

p=Path('dashboard.html')
s=p.read_text()

css='''
/* WINTURBO_DOM_NORMALIZER_V15_CSS */
.main>.section{display:none!important;position:relative!important;clear:both!important;float:none!important;width:100%!important;max-width:100%!important;overflow:visible!important}
.main>.section.on{display:block!important}
.main>.section .card,.main>.section .grid2,.main>.section .grid4,.main>.section .tableWrap{min-width:0;max-width:100%}
.main>.section .card{overflow:hidden}
.main>.section .subv,.main>.section .muted,.main>.section .recLine,.main>.section td,.main>.section th{overflow-wrap:anywhere;word-break:break-word}
#quality,#verification,#contentIdeas{isolation:isolate}
#quality>.grid4,#verification>.grid2,#contentIdeas>.grid2{align-items:stretch}
'''
if 'WINTURBO_DOM_NORMALIZER_V15_CSS' not in s:
    s=s.replace('</style>',css+'\n</style>',1)

js=r'''
/* WINTURBO_DOM_NORMALIZER_V15_START */
function normalizeDashboardSections(){
  const main=document.querySelector('main.main');
  if(!main)return;
  const expected=['overview','growth','creative','telegramSources','otherSources','timing','quality','verification','contentIdeas'];

  // Keep one section per id. Prefer the last copy because the newest patch is appended last.
  expected.forEach(id=>{
    const copies=[...document.querySelectorAll(`section#${id}`)];
    if(!copies.length)return;
    const keep=copies[copies.length-1];
    copies.slice(0,-1).forEach(x=>x.remove());
    if(keep.parentElement!==main)main.appendChild(keep);
    keep.classList.add('section');
  });

  // Remove loose/orphaned content directly under main. Only topbar and dashboard sections belong here.
  [...main.childNodes].forEach(node=>{
    if(node.nodeType===Node.TEXT_NODE){if(node.textContent.trim())node.remove();return;}
    if(node.nodeType!==Node.ELEMENT_NODE)return;
    const el=node;
    if(el.classList.contains('topbar'))return;
    if(el.tagName==='SECTION'&&el.classList.contains('section'))return;
    el.remove();
  });

  // Re-append sections in navigation order so malformed nesting cannot affect layout.
  expected.forEach(id=>{const sec=document.getElementById(id);if(sec)main.appendChild(sec)});

  const activate=id=>{
    expected.forEach(x=>document.getElementById(x)?.classList.toggle('on',x===id));
    document.querySelectorAll('.nav button[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s===id));
  };

  document.querySelectorAll('.nav button[data-s]').forEach(btn=>{
    if(btn.dataset.v15Bound)return;
    btn.dataset.v15Bound='1';
    btn.addEventListener('click',()=>activate(btn.dataset.s));
  });

  const activeBtn=document.querySelector('.nav button.on[data-s]');
  const requested=activeBtn?.dataset.s||'overview';
  activate(document.getElementById(requested)?requested:'overview');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalizeDashboardSections);
else normalizeDashboardSections();
/* WINTURBO_DOM_NORMALIZER_V15_END */
'''

# Replace older normalizer block if present.
sm='/* WINTURBO_DOM_NORMALIZER_V15_START */'; em='/* WINTURBO_DOM_NORMALIZER_V15_END */'
while sm in s and em in s:
    a=s.find(sm); b=s.find(em,a)
    if b<0: break
    s=s[:a]+s[b+len(em):]

idx=s.rfind('</script>')
if idx==-1: raise SystemExit('No script closing tag found')
s=s[:idx]+js+'\n'+s[idx:]

p.write_text(s)
print('normalized dashboard section DOM and removed orphan overlap')
