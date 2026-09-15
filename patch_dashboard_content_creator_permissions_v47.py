from pathlib import Path
p=Path('dashboard.html');s=p.read_text(encoding='utf-8');M='WINTURBO_CONTENT_CREATOR_PERMISSIONS_V47'
if M in s: raise SystemExit(0)
js=r'''<script>/* WINTURBO_CONTENT_CREATOR_PERMISSIONS_V47 */
(function(){
 const CREATIVE=['generateIdeaContent','regenerateIdeaContent','regenerateCreativeOnly'];
 async function canCreate(){const u=(await sb.auth.getUser()).data?.user;if(!u)return false;const g=await sb.from('user_access_grants').select('access_level,allowed_sections,is_active').eq('user_id',u.id).maybeSingle();if(g.data?.access_level==='admin')return true;if(!g.data?.is_active||!(g.data.allowed_sections||[]).includes('contentIdeas'))return false;const a=await sb.from('user_publishing_account_access').select('id').eq('user_id',u.id).eq('is_active',true).eq('can_create',true).limit(1);return !!a.data?.length}
 async function apply(){if(!document.getElementById('contentIdeas'))return;const ok=await canCreate();CREATIVE.forEach(id=>{const el=document.getElementById(id);if(el){el.style.setProperty('display',ok?'':'none','important');el.disabled=!ok}});let n=document.getElementById('contentCreatorPermissionV47');if(!n){n=document.createElement('div');n.id='contentCreatorPermissionV47';n.className='muted small';const b=document.getElementById('generateIdeaContent');b?.parentElement?.insertBefore(n,b)}n.textContent=ok?'Content creation enabled · Generate text, images, reels and videos.':'Content creation requires Content Ideas access plus Create permission on at least one authorized publishing account.';if(ok&&typeof window.syncUi==='function')window.syncUi()}
 document.addEventListener('click',e=>{if(e.target?.dataset?.s==='contentIdeas')setTimeout(apply,100)});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,900),{once:true});else setTimeout(apply,900);setTimeout(apply,2200);
})();</script>'''
s=s.replace('</body>',js+'\n</body>',1);p.write_text(s,encoding='utf-8')