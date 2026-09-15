from pathlib import Path

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')
MARK='WINTURBO_PUBLISHING_ACCESS_V34_START'
if MARK in s:
    print('v34 already present'); raise SystemExit

css='''
/* WINTURBO_PUBLISHING_ACCESS_V34_CSS */
.pubAccessGrid{display:grid;grid-template-columns:1fr 1.4fr;gap:14px}.pubAccountRow,.pubGrantRow{padding:12px;border:1px solid var(--line);border-radius:11px;background:#0b110d;margin-bottom:8px}.pubAccountTop{display:flex;justify-content:space-between;gap:10px}.pubPermissionGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:10px 0}.pubPermissionGrid label{display:flex;gap:7px;align-items:center;font-size:12px}.pubPermissionGrid input{width:auto}.pubDenied{padding:10px;border:1px solid #5a3322;background:#25160e;border-radius:10px;color:#ffc28b}@media(max-width:900px){.pubAccessGrid{grid-template-columns:1fr}}
'''
s=s.replace('</style>',css+'\n</style>',1)

section='''
<div id="publishingAccessPanelV34" class="card" style="margin-top:14px">
 <div class="sectionHead"><div><h3>Telegram & Instagram Posting Access</h3><div class="muted small">Authorize individual users to specific publishing destinations. No destination access means no posting or approval submission.</div></div><span class="pill blue">ACCOUNT LEVEL</span></div>
 <div class="pubAccessGrid">
  <div><label class="k">User</label><select id="pubAccessUser"></select><div class="muted small" style="margin-top:6px">Users must first exist in User Access.</div></div>
  <div><div id="pubAccessAccounts" class="muted">Loading publishing accounts…</div></div>
 </div>
 <div id="pubAccessMsg" class="muted small" style="margin-top:8px"></div>
</div>
'''
# Insert into User Access section if present, otherwise Verification section.
pos=s.find('</section>',s.find('id="userAccess"')) if 'id="userAccess"' in s else -1
if pos<0: pos=s.find('</section>',s.find('id="verification"'))
if pos<0: raise SystemExit('No User Access or Verification section found')
s=s[:pos]+section+s[pos:]

js=r'''
<script>
/* WINTURBO_PUBLISHING_ACCESS_V34_START */
(function(){
 const $=id=>document.getElementById(id), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let me=null,profile=null,accounts=[],users=[],grants=[];
 async function load(){
  const u=await sb.auth.getUser();me=u.data.user;if(!me)return;
  const pr=await sb.from('profiles').select('id,email,role,is_active').eq('id',me.id).maybeSingle();profile=pr.data;
  const panel=$('publishingAccessPanelV34');if(!panel)return;
  if(profile?.role!=='admin'){panel.classList.add('hide');return} panel.classList.remove('hide');
  const [ug,pa,ga]=await Promise.all([
   sb.from('user_access_grants').select('id,email,user_id,access_level,is_active').eq('is_active',true).order('email'),
   sb.from('publishing_accounts').select('*').eq('is_active',true).order('platform').order('account_name'),
   sb.from('user_publishing_account_access').select('*')
  ]);
  users=(ug.data||[]).filter(x=>x.user_id);accounts=pa.data||[];grants=ga.data||[];
  $('pubAccessUser').innerHTML='<option value="">Select authorized user</option>'+users.map(x=>`<option value="${x.user_id}">${esc(x.email)} · ${esc(x.access_level)}</option>`).join('');
  render();
 }
 function render(){
  const uid=$('pubAccessUser')?.value,host=$('pubAccessAccounts');if(!host)return;
  if(!uid){host.innerHTML='<div class="muted">Select a user to assign Telegram / Instagram accounts.</div>';return}
  const rows=accounts.filter(a=>['telegram','instagram'].includes(String(a.platform||'').toLowerCase()));
  host.innerHTML=rows.length?rows.map(a=>{const g=grants.find(x=>x.user_id===uid&&x.publishing_account_id===a.id);return `<div class="pubAccountRow" data-account="${a.id}"><div class="pubAccountTop"><div><b>${esc(a.account_name||a.username||a.external_account_id)}</b><div class="muted small">${esc(a.platform)} · ${esc(a.username||a.external_account_id||'')}</div></div><label><input class="pubEnabled" type="checkbox" ${g?.is_active?'checked':''}> Authorized</label></div><div class="pubPermissionGrid"><label><input class="pubCreate" type="checkbox" ${g?.can_create!==false?'checked':''}> Create content</label><label><input class="pubSubmit" type="checkbox" ${g?.can_submit_for_approval!==false?'checked':''}> Send for approval</label><label><input class="pubApprove" type="checkbox" ${g?.can_approve?'checked':''}> Approve</label><label><input class="pubPublish" type="checkbox" ${g?.can_publish?'checked':''}> Publish</label></div><button class="mini savePubGrant" data-account="${a.id}">Save Access</button></div>`}).join(''):'<div class="muted">No active Telegram or Instagram publishing destinations are configured.</div>';
 }
 async function save(accountId,row){
  const uid=$('pubAccessUser').value;if(!uid)return;
  const payload={user_id:uid,publishing_account_id:accountId,is_active:row.querySelector('.pubEnabled').checked,can_create:row.querySelector('.pubCreate').checked,can_submit_for_approval:row.querySelector('.pubSubmit').checked,can_approve:row.querySelector('.pubApprove').checked,can_publish:row.querySelector('.pubPublish').checked,granted_by:me.id,updated_at:new Date().toISOString()};
  const r=await sb.from('user_publishing_account_access').upsert(payload,{onConflict:'user_id,publishing_account_id'}).select().single();if(r.error)throw r.error;
  const i=grants.findIndex(x=>x.user_id===uid&&x.publishing_account_id===accountId);if(i>=0)grants[i]=r.data;else grants.push(r.data);
  $('pubAccessMsg').textContent='Posting access saved.';
 }
 async function enforce(){
  const u=await sb.auth.getUser();const user=u.data.user;if(!user)return;
  const pr=await sb.from('profiles').select('role').eq('id',user.id).maybeSingle();if(pr.data?.role==='admin')return;
  const ga=await sb.from('user_publishing_account_access').select('publishing_account_id,can_create,can_submit_for_approval,can_approve,can_publish,is_active').eq('user_id',user.id).eq('is_active',true);const allowed=ga.data||[];
  window.WINTURBO_PUBLISHING_ACCESS=allowed;
  document.querySelectorAll('[data-publishing-account-id]').forEach(el=>{const g=allowed.find(x=>x.publishing_account_id===el.dataset.publishingAccountId);if(!g)el.classList.add('hide')});
 }
 document.addEventListener('change',e=>{if(e.target.id==='pubAccessUser')render()});
 document.addEventListener('click',async e=>{const b=e.target.closest?.('.savePubGrant');if(!b)return;b.disabled=true;try{await save(b.dataset.account,b.closest('.pubAccountRow'))}catch(err){$('pubAccessMsg').textContent=err.message||String(err)}finally{b.disabled=false}});
 function boot(){load().catch(console.error);enforce().catch(console.error)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
/* WINTURBO_PUBLISHING_ACCESS_V34_END */
</script>
'''
s=s.replace('</body>',js+'\n</body>',1)
p.write_text(s,encoding='utf-8')
print('Added per-user Telegram/Instagram publishing account authorization.')
