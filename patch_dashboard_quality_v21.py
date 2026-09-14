from pathlib import Path
import re

p = Path('dashboard.html')
s = p.read_text(encoding='utf-8')

QUALITY = r'''<section id="quality" class="section">
  <div class="sectionHead qualityHero">
    <div>
      <div class="qualityEyebrow">SYSTEM HEALTH</div>
      <h2>Data Quality & AI</h2>
      <div class="muted">A simple view of data freshness, coverage, reliability and AI recommendations. This workspace is isolated from every other dashboard section.</div>
    </div>
    <span class="pill" id="qualityHealthBadge">QUALITY CHECK</span>
  </div>

  <div class="qualitySummary">
    <div class="qualityMetric card"><div class="qualityIcon">✓</div><div><div class="k">Data Status</div><div id="qualityStatus" class="qualityValue">Healthy</div><div class="subv">Public / authorized sources only</div></div></div>
    <div class="qualityMetric card"><div class="qualityIcon">◎</div><div><div class="k">Source Coverage</div><div id="qualityCoverage" class="qualityValue">Monitored</div><div class="subv">Telegram, Instagram and web inputs</div></div></div>
    <div class="qualityMetric card"><div class="qualityIcon">◷</div><div><div class="k">Freshness</div><div id="qualityFreshness" class="qualityValue">Auto refresh</div><div class="subv">Latest available scrape is used</div></div></div>
    <div class="qualityMetric card"><div class="qualityIcon">AI</div><div><div class="k">AI Confidence</div><div id="qualityConfidence" class="qualityValue">Evidence-led</div><div class="subv">No missing metric is treated as zero</div></div></div>
  </div>

  <div class="qualityGrid">
    <div class="card qualityPanel">
      <div class="sectionHead"><div><h3>Quality Rules</h3><div class="muted small">How WinTurbo decides whether information is reliable enough to use.</div></div><span class="pill blue">RULES</span></div>
      <div id="qualityRules" class="qualityChecklist">
        <div class="qualityRule"><span class="qualityDot good"></span><div><b>Freshness first</b><div class="muted small">Recent source updates are preferred over stale observations.</div></div></div>
        <div class="qualityRule"><span class="qualityDot good"></span><div><b>Visible metrics only</b><div class="muted small">Views and reactions are shown only when publicly observable.</div></div></div>
        <div class="qualityRule"><span class="qualityDot good"></span><div><b>No fabricated values</b><div class="muted small">Unavailable reactions or engagement are marked unavailable, never converted to zero.</div></div></div>
        <div class="qualityRule"><span class="qualityDot good"></span><div><b>Source-aware analysis</b><div class="muted small">Recommendations retain the platform and evidence context behind them.</div></div></div>
      </div>
    </div>

    <div class="card qualityPanel">
      <div class="sectionHead"><div><h3>Collection Health</h3><div class="muted small">Where data comes from and how it is treated.</div></div><span class="pill">LIVE</span></div>
      <div id="qualitySources" class="qualitySourceList">
        <div class="qualitySource"><div><b>Telegram</b><div class="muted small">Public pages + authorized fallback</div></div><span class="qualityState">Observed</span></div>
        <div class="qualitySource"><div><b>Instagram</b><div class="muted small">Configured public collection</div></div><span class="qualityState">Observed</span></div>
        <div class="qualitySource"><div><b>Web</b><div class="muted small">Configured public landing pages</div></div><span class="qualityState">Observed</span></div>
        <div class="qualitySource"><div><b>Supabase</b><div class="muted small">Normalized intelligence store</div></div><span class="qualityState">Connected</span></div>
      </div>
    </div>
  </div>

  <div class="card qualityRecommendations">
    <div class="sectionHead"><div><h3>AI Recommendations</h3><div class="muted small">Actionable recommendations derived from observed competitor content and measurable evidence.</div></div><span class="pill orange">AI</span></div>
    <div id="aiRecommendations" class="qualityAiBody"><div class="aiItem muted">Recommendations will appear here when enough evidence is available.</div></div>
  </div>
</section>'''

# Replace the entire quality section structurally. Verification is the next canonical section.
start = s.find('<section id="quality"')
end = s.find('<section id="verification"', start if start >= 0 else 0)
if start < 0 or end < 0 or end <= start:
    raise SystemExit('Could not locate canonical quality -> verification boundary')
s = s[:start] + QUALITY + '\n' + s[end:]

# Remove old v21 style/runtime blocks if present so this remains idempotent.
s = re.sub(r'\n?/\* WINTURBO_QUALITY_V21_CSS \*/.*?(?=\n/\*|\n</style>)', '', s, flags=re.S)
s = re.sub(r'<script>\s*/\* WINTURBO_QUALITY_V21_START \*/.*?/\* WINTURBO_QUALITY_V21_END \*/\s*</script>', '', s, flags=re.S)

css = r'''
/* WINTURBO_QUALITY_V21_CSS */
#quality{--qgreen:#42e36c;--qpanel:#0e1510;--qline:#223027}
#quality .qualityHero{padding:4px 0 2px;margin-bottom:18px}
#quality .qualityEyebrow{font-size:10px;font-weight:900;letter-spacing:.14em;color:var(--green);margin-bottom:5px}
#quality .qualityHero h2{font-size:26px;margin:0 0 5px;letter-spacing:-.04em}
#quality .qualitySummary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:14px}
#quality .qualityMetric{display:flex;align-items:flex-start;gap:12px;padding:17px;box-shadow:none}
#quality .qualityIcon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:rgba(66,227,108,.10);border:1px solid rgba(66,227,108,.22);color:var(--green);font-size:12px;font-weight:950;flex:0 0 auto}
#quality .qualityValue{font-size:18px;font-weight:900;margin-top:4px;letter-spacing:-.025em}
#quality .qualityGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
#quality .qualityPanel{padding:18px;box-shadow:none}
#quality .qualityChecklist,#quality .qualitySourceList{display:grid;gap:9px}
#quality .qualityRule,#quality .qualitySource{display:flex;align-items:flex-start;gap:10px;padding:11px 12px;background:#0a100c;border:1px solid #1e2a21;border-radius:11px}
#quality .qualitySource{justify-content:space-between;align-items:center}
#quality .qualityDot{width:9px;height:9px;border-radius:99px;margin-top:6px;flex:0 0 auto;background:#627068}
#quality .qualityDot.good{background:var(--green);box-shadow:0 0 0 4px rgba(66,227,108,.08)}
#quality .qualityState{font-size:11px;font-weight:850;color:#9bf2ad;background:#15301d;border:1px solid #214a2b;padding:4px 8px;border-radius:999px;white-space:nowrap}
#quality .qualityRecommendations{padding:18px;box-shadow:none}
#quality .qualityAiBody{display:grid;gap:10px}
#quality .qualityAiBody .aiItem{margin:0}
/* Quality-only components are never visible outside the quality section. */
main.main > section.section:not(#quality) .qualityHero,
main.main > section.section:not(#quality) .qualitySummary,
main.main > section.section:not(#quality) .qualityMetric,
main.main > section.section:not(#quality) .qualityGrid,
main.main > section.section:not(#quality) .qualityPanel,
main.main > section.section:not(#quality) .qualityRecommendations,
main.main > section.section:not(#quality) #aiRecommendations,
main.main > section.section:not(#quality) #qualityRules,
main.main > section.section:not(#quality) #qualitySources{display:none!important}
@media(max-width:1150px){#quality .qualitySummary{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:800px){#quality .qualitySummary,#quality .qualityGrid{grid-template-columns:1fr}}
'''
s = s.replace('</style>', css + '\n</style>', 1)

js = r'''
<script>
/* WINTURBO_QUALITY_V21_START */
(function(){
  const qualityPhrases=[
    'Data Quality & AI Recommendations','Data Quality Rules','Monitored Data Sources',
    'AI Content Recommendations','Telegram Evidence','Instagram Evidence','Web Evidence',
    'AI Recommendation Output','Public / Authorized','Source Coverage','Collection Health'
  ];
  const protectedIds=new Set([
    'overview','growth','creative','telegramSources','otherSources','timing','verification','contentIdeas',
    'telegramPublishStatus','telegramPublishingAccounts','telegramPermissionDetail','verifyTelegramConnection','telegramVerifyMessage',
    'ideaType','ideaPlatform','ideaInput','ideaTone','ideaFormat','imageEngine','generateIdeaContent','ideaStatus','ideaDraft',
    'higgsfieldGenerationStatus','higgsfieldPreview','readyPostCopy','readyPostMedia','publishIdeaTelegram'
  ]);
  let cleaning=false;
  function hasPhrase(el){const t=(el.textContent||'').replace(/\s+/g,' ').trim();return qualityPhrases.some(x=>t.includes(x));}
  function clean(){
    if(cleaning) return; cleaning=true;
    document.querySelectorAll('main.main > section.section:not(#quality)').forEach(sec=>{
      [...sec.querySelectorAll('.qualityHero,.qualitySummary,.qualityMetric,.qualityGrid,.qualityPanel,.qualityRecommendations')].forEach(x=>x.remove());
      [...sec.querySelectorAll('.card,.grid2,.grid4,.successGrid,.recGrid,.aiItem')].forEach(el=>{
        if([...protectedIds].some(id=>el.id===id || (el.querySelector && el.querySelector('#'+id)))) return;
        if(hasPhrase(el)) el.remove();
      });
    });
    cleaning=false;
  }
  function boot(){
    clean();
    const main=document.querySelector('main.main');
    if(main){const mo=new MutationObserver(()=>requestAnimationFrame(clean));mo.observe(main,{childList:true,subtree:true});}
    setTimeout(clean,300);setTimeout(clean,1200);setTimeout(clean,2500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
/* WINTURBO_QUALITY_V21_END */
</script>
'''
s = s.replace('</body>', js + '\n</body>', 1)

p.write_text(s, encoding='utf-8')
print('Rebuilt Data Quality & AI and removed quality leakage from every other section.')
