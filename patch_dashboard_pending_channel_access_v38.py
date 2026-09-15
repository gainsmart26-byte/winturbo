from pathlib import Path
p=Path('dashboard.html');s=p.read_text(encoding='utf-8');M='WINTURBO_PENDING_CHANNEL_ACCESS_V38'
if M in s:
    raise SystemExit(0)
js=r'''<script>/* WINTURBO_PENDING_CHANNEL_ACCESS_V38 */
(function(){
async function refreshPendingUsers(){const sel=document.getElementById('channelAccessUserV37');if(!sel||!window.sb)return;const r=await sb.from('user_access_grants').select('email,user_id,access_level,is_active').eq('is_active',true).order('email');if(r.error)return;const current=sel.value;sel.innerHTML='<option value="">Select authorized user</option>'+(r.data||[]).map(x=>`<option value="${x.user_id||''}" data-email="${x.email}" ${x.user_id?'':'disabled'}>${x.email} · ${x.access_level}${x.user_id?'':' · Awaiting Login'}</option>`).join('');if(current&&[...sel.options].some(o=>o.value===current))sel.value=current}
async function tryLinkCurrentUser(){const u=(await sb.auth.getUser()).data?.user;if(!u?.id||!u?.email)return;const r=await sb.from('user_access_grants').select('id,user_id,is_active').ilike('email',u.email).eq('is_active',true).maybeSingle();if(r.data&&!r.data.user_id){const x=await sb.from('user_access_grants').update({user_id:u.id,updated_at:new Date().toISOString()}).eq('id',r.data.id).is('user_id',null);if(!x.error)await refreshPendingUsers()}}
window.WinTurboRefreshPendingChannelUsersV38=refreshPendingUsers;const run=()=>{tryLinkCurrentUser().catch(console.error);refreshPendingUsers().catch(console.error)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,700),{once:true});else setTimeout(run,700);})();
</script>'''
s=s.replace('</body>',js+'\n</body>',1);p.write_text(s,encoding='utf-8')