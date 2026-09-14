from pathlib import Path
import re

p=Path('dashboard.html')
s=p.read_text(encoding='utf-8')

approval=r'''
<section id="approval" class="section">
  <div class="sectionHead"><div><h2>Approval</h2><div class="muted small">Every post, story and creative generated in the WinTurbo dashboard enters this queue before publishing. Approve means publish; Reject permanently marks the item rejected.</div></div><span class="pill">CONTENT CONTROL</span></div>
  <div class="grid4">
    <div class="card"><div class="k">PENDING APPROVAL</div><div class="v" id="approvalPending">—</div><div class="subv">Waiting for action</div></div>
    <div class="card"><div class="k">APPROVED / PUBLISHED</div><div class="v" id="approvalApproved">—</div><div class="subv">Accumulated successfully posted</div></div>
    <div class="card"><div class="k">REJECTED</div><div class="v" id="approvalRejected">—</div><div class="subv">Accumulated rejected content</div></div>
    <div class="card"><div class="k">FAILED</div><div class="v" id="approvalFailed">—</div><div class="subv">Publishing needs attention</div></div>
  </div>
  <div class="sectionHead" style="margin-top:20px"><div><h3>Pending Approval</h3><div class="muted small">Approve publishes immediately when the platform connection is available. Reject moves the content to the rejected archive.</div></div></div>
  <div id="approvalPendingCards" class="approvalGrid"><div class="muted">Loading pending content…</div></div>
  <div class="sectionHead" style="margin-top:24px"><div><h3>Approved / Published</h3><div class="muted small">Accumulated publishing history with exact publication date and time.</div></div></div>
  <div id="approvalPublishedCards" class="approvalGrid"><div class="muted">Loading published content…</div></div>
  <div class="sectionHead" style="margin-top:24px"><div><h3>Rejected</h3><div class="muted small">Accumulated rejected content with rejection date and time.</div></div></div>
  <div id="approvalRejectedCards" class="approvalGrid"><div class="muted">Loading rejected content…</div></div>
  <div class="sectionHead" style="margin-top:24px"><div><h3>Failed</h3><div class="muted small">Items that could not be published.</div></div></div>
  <div id="approvalFailedCards" class="approvalGrid"><div class="muted">Loading failed content…</div></div>
</section>
'''
pat=r'<section id="approval" class="section(?: on)?">.*?</section>'
s,n=re.subn(pat,approval,s,count=1,flags=re.S)
if n!=1: raise SystemExit('approval section not found')

css='''\n/* WINTURBO_APPROVAL_V25_CSS */\n.statusRejected{color:#ff9b9b}.approvalMeta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:10px 0}.approvalMeta div{background:#09100b;border:1px solid var(--line);border-radius:9px;padding:8px}.approvalMeta b{display:block;font-size:11px}.approvalMeta span{font-size:10px;color:var(--muted)}\n'''
s=s.replace('</style>',css+'\n</style>',1)

pat=r'''  function renderApprovals\(rows\)\{.*?\n  \}\n\n  async function publishTelegramQueue'''
replacement=r'''  function renderApprovals(rows){
    queueRows=rows||[];
    const pending=queueRows.filter(x=>x.status==='draft');
    const published=queueRows.filter(x=>x.status==='published');
    const rejected=queueRows.filter(x=>x.status==='rejected'||x.status==='cancelled');
    const failed=queueRows.filter(x=>x.status==='failed');
    set('approvalPending',pending.length);
    set('approvalApproved',published.length);
    set('approvalRejected',rejected.length);
    set('approvalFailed',failed.length);

    const card=q=>{
      const media=q.media_url?(q.media_type==='video'?`<video class="approvalMedia" controls playsinline src="${esc(url(q.media_url))}"></video>`:`<img class="approvalMedia" alt="Queued creative" src="${esc(url(q.media_url))}">`):'';
      const cls=q.status==='draft'?'statusDraft':q.status==='published'?'statusPublished':q.status==='rejected'||q.status==='cancelled'?'statusRejected':q.status==='failed'?'statusFailed':'statusApproved';
      const status=q.status==='cancelled'?'rejected':q.status;
      const publishedMeta=q.published_at?`<div><b>${dt(q.published_at)}</b><span>Published date & time</span></div>`:'';
      const rejectedMeta=q.rejected_at?`<div><b>${dt(q.rejected_at)}</b><span>Rejected date & time</span></div>`:'';
      return `<article class="approvalCard"><div style="display:flex;justify-content:space-between;gap:10px"><div><b>${esc(String(q.platform||'').toUpperCase())}</b><div class="muted small">Created ${dt(q.created_at)}</div></div><b class="${cls}">${esc(status||'draft')}</b></div>${media}<div class="approvalMeta"><div><b>${dt(q.created_at)}</b><span>Created date & time</span></div>${publishedMeta}${rejectedMeta}</div><div class="copy">${esc(q.content_text||'')}</div>${q.published_url?`<a class="openExternal" target="_blank" rel="noopener noreferrer" href="${esc(url(q.published_url))}">Open published post ↗</a>`:''}<div class="recActions">${q.status==='draft'?`<button class="primary approveQueue" data-id="${esc(q.id)}" data-platform="${esc(q.platform)}">Approve & Publish</button><button class="ghost rejectQueue" data-id="${esc(q.id)}">Reject</button>`:''}</div>${q.error_message?`<div class="small statusFailed" style="margin-top:8px">${esc(q.error_message)}</div>`:''}</article>`;
    };
    const render=(id,arr,empty)=>{const host=$(id);if(host)host.innerHTML=arr.length?[...arr].sort((a,b)=>new Date(b.published_at||b.rejected_at||b.created_at)-new Date(a.published_at||a.rejected_at||a.created_at)).map(card).join(''):`<div class="muted">${empty}</div>`};
    render('approvalPendingCards',pending,'No content is waiting for approval.');
    render('approvalPublishedCards',published,'No approved/published content yet.');
    render('approvalRejectedCards',rejected,'No rejected content yet.');
    render('approvalFailedCards',failed,'No failed publishing items.');
  }

  async function publishTelegramQueue'''
s,n=re.subn(pat,replacement,s,count=1,flags=re.S)
if n!=1: raise SystemExit('renderApprovals function not found')

pat=r'''  async function approveQueue\(id,platform\)\{.*?\n  \}\n  async function rejectQueue\(id\)\{.*?\}\n'''
replacement=r'''  async function approveQueue(id,platform){
    const account=publishingAccounts.find(a=>a.platform===platform&&a.connection_status==='connected')||publishingAccounts.find(a=>a.platform===platform)||null;
    if(platform==='telegram'){
      if(!account||account.connection_status!=='connected')throw new Error('Telegram publishing account is not connected.');
      if(account?.id){const {error}=await sb.from('publishing_queue').update({publishing_account_id:account.id,status:'approved'}).eq('id',id);if(error)throw error;}
      await publishTelegramQueue(id);
    }else if(platform==='instagram'){
      throw new Error('Instagram publishing is not connected yet. Content remains pending approval until Meta publishing is connected.');
    }else{
      throw new Error('Publishing is not configured for this platform.');
    }
    await hydrate();
  }
  async function rejectQueue(id){
    const {error}=await sb.from('publishing_queue').update({status:'rejected',rejected_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await hydrate();
  }
'''
s,n=re.subn(pat,replacement,s,count=1,flags=re.S)
if n!=1: raise SystemExit('approve/reject functions not found')

# Expose the single approval queue path for every current/future generator in the dashboard.
s=s.replace("await hydrate();show('approval');\n  }", "await hydrate();show('approval');\n  }\n  window.WinTurboSendToApproval=sendCurrentToApproval;",1)

p.write_text(s,encoding='utf-8')
print('Approval v25: centralized queue, approve=publish, reject archive, cumulative cards and timestamps.')
