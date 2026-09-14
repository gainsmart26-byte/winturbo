from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

# Remove prior runtime if re-run.
s=re.sub(r'<script>\s*/\* WINTURBO_USER_ACCESS_V33_START \*/.*?/\* WINTURBO_USER_ACCESS_V33_END \*/\s*</script>','',s,flags=re.S)
s=re.sub(r'/\* WINTURBO_USER_ACCESS_V33_CSS \*/.*?(?=\n/\*|\n</style>)','',s,flags=re.S)
s=re.sub(r'<section id="userAccess" class="section(?: on)?">.*?</section>','',s,flags=re.S)

# Add admin-only navigation entry.
if 'data-s="userAccess"' not in s:
    m=re.search(r'(<div class="nav"[^>]*>)(.*?)(</div>)',s,flags=re.S)
    if m:
        nav=m.group(1)+m.group(2)+'\n<button data-s="userAccess">User Access</button>\n'+m.group(3)
        s=s[:m.start()]+nav+s[m.end():]

section=r'''
<section id="userAccess" class="section">
  <div class="sectionHead">
    <div><h2>User Access</h2><div class="muted small">Authorize users by email and control Admin, View Only, or section-specific access.</div></div>
    <span class="pill">ADMIN ONLY</span>
  </div>
  <div class="grid2 accessGrid">
    <div class="card">
      <div class="sectionHead"><div><h3 style="margin:0">Authorize User</h3><div class="muted small">The email can be authorized before the person creates or signs into their account.</div></div></div>
      <input id="accessGrantId" type="hidden">
      <label class="small muted">Email address</label>
      <input id="accessEmail" type="email" placeholder="user@example.com" autocomplete="off">
      <label class="small muted" style="display:block;margin-top:12px">Access level</label>
      <select id="accessLevel">
        <option value="admin">Admin — Full dashboard + management</option>
        <option value="view">View Only — All sections, no changes</option>
        <option value="section">Section Access — Selected sections only</option>
      </select>
      <div id="sectionAccessPicker" class="sectionPicker" style="display:none">
        <div class="k" style="margin:14px 0 8px">Allowed sections</div>
        <div id="sectionAccessChecks" class="accessChecks"></div>
      </div>
      <label class="accessActive"><input id="accessActive" type="checkbox" checked> <span>Access active</span></label>
      <div id="accessMsg" class="small muted" style="margin-top:10px"></div>
      <div class="modalActions"><button id="clearAccessForm" class="ghost">Clear</button><button id="saveAccessGrant" class="primary">Save Access</button></div>
    </div>
    <div class="card">
      <div class="sectionHead"><div><h3 style="margin:0">Access Model</h3><div class="muted small">How permissions work across the dashboard.</div></div></div>
      <div class="accessRule"><b>Admin</b><span>All sections, data-source management, AI generation, approval and publishing controls, and User Access management.</span></div>
      <div class="accessRule"><b>View Only</b><span>Can see all dashboard sections and analytics but cannot add sources, generate/queue content, approve, reject, or publish.</span></div>
      <div class="accessRule"><b>Section Access</b><span>Can only see the selected sections and remains read-only.</span></div>
      <div class="accessRule"><b>Email authorization</b><span>Pre-authorized emails receive their assigned access when they sign in. Unapproved new accounts stay inactive.</span></div>
    </div>
  </div>
  <div class="card" style="margin-top:14px">
    <div class="sectionHead"><div><h3 style="margin:0">Authorized Users</h3><div class="muted small">Edit, deactivate, or revoke dashboard access.</div></div><button id="refreshAccessList" class="ghost">Refresh</button></div>
    <div class="tableWrap"><table><thead><tr><th>Email</th><th>Access</th><th>Sections</th><th>Status</th><th>Account</th><th>Updated</th><th>Actions</th></tr></thead><tbody id="accessUsersBody"><tr><td colspan="7" class="muted">Loading access grants…</td></tr></tbody></table></div>
  </div>
</section>
'''

idx=s.rfind('</main>')
if idx<0: raise SystemExit('main closing tag not found')
s=s[:idx]+section+'\n'+s[idx:]

css=r'''
/* WINTURBO_USER_ACCESS_V33_CSS */
#userAccess .accessGrid{grid-template-columns:1.15fr .85fr}
#userAccess .sectionPicker{margin-top:4px}
#userAccess .accessChecks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
#userAccess .accessCheck{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:#0a100c}
#userAccess .accessCheck input,#userAccess .accessActive input{width:auto}
#userAccess .accessActive{display:flex;align-items:center;gap:8px;margin-top:14px}
#userAccess .accessRule{padding:11px 0;border-bottom:1px solid var(--line)}
#userAccess .accessRule:last-child{border-bottom:0}
#userAccess .accessRule b{display:block;margin-bottom:4px}.accessRule span{color:var(--muted);font-size:12px}
.accessReadOnlyNote{position:fixed;right:18px;bottom:18px;z-index:50;background:#172019;border:1px solid var(--line);border-radius:999px;padding:8px 12px;font-size:11px;color:#b9ffc9;box-shadow:0 8px 25px rgba(0,0,0,.28)}
@media(max-width:900px){#userAccess .accessGrid{grid-template-columns:1fr}#userAccess .accessChecks{grid-template-columns:1fr}}
'''
s=s.replace('</style>',css+'\n</style>',1)

js=r'''
<script>
/* WINTURBO_USER_ACCESS_V33_START */
(function(){
  const q=id=>document.getElementById(id);
  const escA=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const SECTIONS=[
    ['overview','Executive Overview'],['growth','Growth Analytics'],['creative','Creative Explorer'],
    ['telegramSources','Telegram Sources'],['otherSources','Instagram & Web'],['discordSources','Discord Sources'],
    ['timing','Posting Intelligence'],['quality','Data Quality & AI'],['verification','Verification'],
    ['contentIdeas','Content Ideas'],['approval','Approval']
  ];
  let accessContext=null;
  let accessRows=[];

  function setAccessMessage(msg,isErr=false){const el=q('accessMsg');if(el){el.textContent=msg||'';el.className='small '+(isErr?'error':'muted')}}
  function levelLabel(v){return v==='admin'?'Admin':v==='section'?'Section Access':'View Only'}
  function showSectionDirect(id){
    document.querySelectorAll('main.main > section.section').forEach(sec=>{const on=sec.id===id;sec.classList.toggle('on',on);sec.style.setProperty('display',on?'block':'none','important')});
    document.querySelectorAll('.nav button[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s===id));
    const title=q('title');if(title)title.textContent=id==='userAccess'?'User Access':(SECTIONS.find(x=>x[0]===id)?.[1]||id);
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function allowedSet(ctx){
    if(ctx?.access_level==='admin'||ctx?.access_level==='view')return new Set(SECTIONS.map(x=>x[0]));
    return new Set((ctx?.allowed_sections||[]).filter(x=>SECTIONS.some(s=>s[0]===x)));
  }
  function setReadOnlyUI(readOnly){
    document.getElementById('accessReadOnlyNote')?.remove();
    const selectors=['#addSourceBtn','#addSourceInline','#addDiscordSource','#saveSource','#generateIdeaContent','#regenerateIdeaContent','#regenerateCreativeOnly','#publishIdeaTelegram','#publishTelegram','.approveQueue','.rejectQueue','.publishQueue','.recGenerate','.recApprove','.qualityGenerate','.qualitySendApproval'];
    document.querySelectorAll(selectors.join(',')).forEach(el=>{el.style.display=readOnly?'none':'';el.disabled=!!readOnly});
    if(readOnly){const n=document.createElement('div');n.id='accessReadOnlyNote';n.className='accessReadOnlyNote';n.textContent='VIEW ONLY ACCESS';document.body.appendChild(n)}
  }
  function applyAccessUI(ctx){
    accessContext=ctx;
    const admin=ctx?.access_level==='admin';
    const allowed=allowedSet(ctx);
    document.querySelectorAll('.nav button[data-s]').forEach(b=>{
      const id=b.dataset.s;
      b.style.display=(id==='userAccess'?admin:allowed.has(id))?'':'none';
    });
    const ua=q('userAccess');if(ua)ua.style.display='none';
    setReadOnlyUI(!admin);
    const current=document.querySelector('main.main > section.section.on')?.id;
    if(current==='userAccess'&&!admin)showSectionDirect([...allowed][0]||'overview');
    else if(current&&!allowed.has(current)&&current!=='userAccess')showSectionDirect([...allowed][0]||'overview');
  }

  async function loadCurrentAccess(){
    const {data:{user}}=await sb.auth.getUser();
    if(!user)return null;
    const [{data:profile},{data:grant}]=await Promise.all([
      sb.from('profiles').select('id,email,role,is_active').eq('id',user.id).maybeSingle(),
      sb.from('user_access_grants').select('*').ilike('email',user.email||'').maybeSingle()
    ]);
    if(profile?.role==='admin'&&profile?.is_active!==false&&!grant)return {email:user.email,access_level:'admin',allowed_sections:[],is_active:true};
    if(!profile?.is_active||!grant?.is_active)return null;
    return grant;
  }
  async function enforceAccess(){
    const ctx=await loadCurrentAccess();
    const {data:{user}}=await sb.auth.getUser();
    if(!user)return;
    if(!ctx){
      q('app')?.classList.add('hide');q('login')?.classList.remove('hide');
      if(q('msg'))q('msg').textContent='This email is not authorized for dashboard access. Ask an administrator to add it in User Access.';
      await sb.auth.signOut();return;
    }
    q('login')?.classList.add('hide');q('app')?.classList.remove('hide');
    applyAccessUI(ctx);
    if(ctx.access_level==='admin')await renderAccessUsers();
  }

  function buildSectionChecks(){
    const host=q('sectionAccessChecks');if(!host)return;
    host.innerHTML=SECTIONS.map(([id,label])=>`<label class="accessCheck"><input type="checkbox" value="${escA(id)}"> <span>${escA(label)}</span></label>`).join('');
  }
  function syncLevelPicker(){const wrap=q('sectionAccessPicker');if(wrap)wrap.style.display=q('accessLevel')?.value==='section'?'block':'none'}
  function clearForm(){if(q('accessGrantId'))q('accessGrantId').value='';if(q('accessEmail'))q('accessEmail').value='';if(q('accessLevel'))q('accessLevel').value='view';if(q('accessActive'))q('accessActive').checked=true;document.querySelectorAll('#sectionAccessChecks input').forEach(x=>x.checked=false);syncLevelPicker();setAccessMessage('')}
  function editGrant(id){
    const g=accessRows.find(x=>x.id===id);if(!g)return;
    q('accessGrantId').value=g.id;q('accessEmail').value=g.email||'';q('accessLevel').value=g.access_level||'view';q('accessActive').checked=g.is_active!==false;
    const set=new Set(g.allowed_sections||[]);document.querySelectorAll('#sectionAccessChecks input').forEach(x=>x.checked=set.has(x.value));syncLevelPicker();setAccessMessage('Editing '+g.email);
    q('accessEmail')?.focus();
  }
  async function saveGrant(){
    const email=(q('accessEmail')?.value||'').trim().toLowerCase();const level=q('accessLevel')?.value||'view';const active=!!q('accessActive')?.checked;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setAccessMessage('Enter a valid email address.',true);return}
    const sections=level==='section'?[...document.querySelectorAll('#sectionAccessChecks input:checked')].map(x=>x.value):[];
    if(level==='section'&&!sections.length){setAccessMessage('Select at least one section for Section Access.',true);return}
    const btn=q('saveAccessGrant');if(btn){btn.disabled=true;btn.textContent='Saving…'};setAccessMessage('Saving access…');
    try{
      const id=q('accessGrantId')?.value;
      let error;
      if(id){({error}=await sb.from('user_access_grants').update({email,access_level:level,allowed_sections:sections,is_active:active}).eq('id',id));}
      else{
        const {data:existing}=await sb.from('user_access_grants').select('id').ilike('email',email).maybeSingle();
        if(existing?.id)({error}=await sb.from('user_access_grants').update({access_level:level,allowed_sections:sections,is_active:active}).eq('id',existing.id));
        else {const {data:{user}}=await sb.auth.getUser();({error}=await sb.from('user_access_grants').insert({email,access_level:level,allowed_sections:sections,is_active:active,granted_by:user?.id||null}));}
      }
      if(error)throw error;
      setAccessMessage('Access saved successfully.');clearForm();await renderAccessUsers();
    }catch(e){setAccessMessage(e?.message||String(e),true)}finally{if(btn){btn.disabled=false;btn.textContent='Save Access'}}
  }
  async function revokeGrant(id){if(!confirm('Deactivate this user\'s dashboard access?'))return;const {error}=await sb.from('user_access_grants').update({is_active:false}).eq('id',id);if(error)alert(error.message);else await renderAccessUsers()}
  async function deleteGrant(id){if(!confirm('Permanently remove this access grant? The linked profile will be deactivated.'))return;const {error}=await sb.from('user_access_grants').delete().eq('id',id);if(error)alert(error.message);else await renderAccessUsers()}
  async function renderAccessUsers(){
    if(accessContext?.access_level!=='admin')return;
    const {data,error}=await sb.from('user_access_grants').select('*').order('updated_at',{ascending:false});
    const body=q('accessUsersBody');if(error){if(body)body.innerHTML=`<tr><td colspan="7" class="error">${escA(error.message)}</td></tr>`;return}
    accessRows=data||[];
    if(body)body.innerHTML=accessRows.length?accessRows.map(g=>{
      const secs=g.access_level==='section'?(g.allowed_sections||[]).map(id=>SECTIONS.find(x=>x[0]===id)?.[1]||id).join(', '):'All dashboard sections';
      return `<tr><td><b>${escA(g.email)}</b></td><td><span class="pill ${g.access_level==='admin'?'':'blue'}">${escA(levelLabel(g.access_level))}</span></td><td>${escA(secs)}</td><td>${g.is_active?'<span class="pill">ACTIVE</span>':'<span class="pill orange">INACTIVE</span>'}</td><td>${g.user_id?'Linked':'Pre-authorized'}</td><td>${g.updated_at?new Date(g.updated_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}):'—'}</td><td><div class="recActions"><button class="mini accessEdit" data-id="${escA(g.id)}">Edit</button><button class="mini accessRevoke" data-id="${escA(g.id)}">Deactivate</button><button class="mini accessDelete" data-id="${escA(g.id)}">Remove</button></div></td></tr>`;
    }).join(''):'<tr><td colspan="7" class="muted">No authorized users yet.</td></tr>';
  }

  function bind(){
    buildSectionChecks();syncLevelPicker();
    q('accessLevel')?.addEventListener('change',syncLevelPicker);
    q('clearAccessForm')?.addEventListener('click',clearForm);
    q('saveAccessGrant')?.addEventListener('click',saveGrant);
    q('refreshAccessList')?.addEventListener('click',renderAccessUsers);
    document.addEventListener('click',e=>{
      const nav=e.target.closest?.('.nav button[data-s="userAccess"]');if(nav){e.preventDefault();e.stopPropagation();if(accessContext?.access_level==='admin'){showSectionDirect('userAccess');renderAccessUsers()}return}
      const edit=e.target.closest?.('.accessEdit');if(edit){e.preventDefault();editGrant(edit.dataset.id);return}
      const rev=e.target.closest?.('.accessRevoke');if(rev){e.preventDefault();revokeGrant(rev.dataset.id);return}
      const del=e.target.closest?.('.accessDelete');if(del){e.preventDefault();deleteGrant(del.dataset.id);return}
    },false);
    const login=q('loginBtn');if(login){login.onclick=async()=>{if(q('msg'))q('msg').textContent='Signing in…';const {data,error}=await sb.auth.signInWithPassword({email:q('email').value.trim(),password:q('pass').value});if(error){if(q('msg'))q('msg').textContent=error.message;return}if(data?.user){const ctx=await loadCurrentAccess();if(!ctx){if(q('msg'))q('msg').textContent='This email is not authorized for dashboard access.';await sb.auth.signOut();return}if(typeof showApp==='function')showApp();applyAccessUI(ctx);if(ctx.access_level==='admin')renderAccessUsers();}}}
    sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user)setTimeout(enforceAccess,0)});
    setTimeout(enforceAccess,100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
/* WINTURBO_USER_ACCESS_V33_END */
</script>
'''
s=s.replace('</body>',js+'\n</body>',1)

p.write_text(s,encoding='utf-8')
print('User Access v33: email authorization, admin/view/section permissions, and read-only enforcement.')
