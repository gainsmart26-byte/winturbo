from pathlib import Path

p=Path('dashboard.html')
s=p.read_text()

# Add publishing controls to the generated-content modal.
s=s.replace('<button id="copyPost" class="primary">Copy Post</button>', '<button id="publishTelegram" class="primary">Post to Telegram</button><button id="copyPost" class="ghost">Copy Post</button>', 1)

# Add Telegram publishing status card to Data Quality.
quality_card='''<div class="card" style="margin-bottom:13px"><div class="sectionHead"><div><h3>Telegram Publishing</h3><div class="muted small">Approved AI drafts can be published directly to a connected Telegram channel.</div></div><span id="telegramPublishStatus" class="pill orange">NOT CONNECTED</span></div><div class="grid4"><div><div class="k">Publishing Accounts</div><div id="telegramPublishingAccounts" class="v" style="font-size:19px">0</div></div><div><div class="k">Publish Mode</div><div class="v" style="font-size:19px">Manual Approval</div><div class="subv">Nothing posts automatically without clicking Post to Telegram</div></div><div><div class="k">Permission Check</div><div id="telegramPermissionDetail" class="v" style="font-size:17px">Not verified</div><div class="subv">Bot auth · channel · admin · can post</div></div><div><div class="k">Connection Test</div><button id="verifyTelegramConnection" class="primary">Verify Telegram Connection</button><div id="telegramVerifyMessage" class="subv" style="margin-top:8px">Uses secure server-side bot token</div></div></div></div>'''
s=s.replace('<div class="card" style="margin-bottom:13px"><div class="sectionHead"><div><h3>Likely to Be Successful — AI Intelligence</h3>', quality_card+'<div class="card" style="margin-bottom:13px"><div class="sectionHead"><div><h3>Likely to Be Successful — AI Intelligence</h3>',1)

# Track publishing accounts and load them with the dashboard.
s=s.replace('allSources=[],allSuccess=[];', 'allSources=[],allSuccess=[],allPublishingAccounts=[];',1)
s=s.replace('async function loadSuccess(){', "async function loadPublishingAccounts(){const{data}=await sb.from('publishing_accounts').select('*').eq('platform','telegram').eq('is_active',true).order('created_at',{ascending:false});allPublishingAccounts=data||[];if($('telegramPublishingAccounts'))$('telegramPublishingAccounts').textContent=allPublishingAccounts.length;if($('telegramPublishStatus')){const ok=allPublishingAccounts.some(x=>x.connection_status==='connected');$('telegramPublishStatus').textContent=ok?'CONNECTED':(allPublishingAccounts.length?'SETUP REQUIRED':'NOT CONNECTED');$('telegramPublishStatus').className='pill '+(ok?'':'orange')}}\nasync function loadSuccess(){",1)
s=s.replace('loadSources(),loadSuccess()]);', 'loadSources(),loadSuccess(),loadPublishingAccounts()]);')

# Publish the currently generated/edited text after explicit user approval.
publish_js=r'''
async function verifyTelegramConnection(){
  const btn=$('verifyTelegramConnection');
  if(!btn)return;
  const old=btn.textContent;btn.disabled=true;btn.textContent='Verifying…';
  try{
    const account=allPublishingAccounts[0];
    const channel='@'+String(account?.username||'winturboplay').replace(/^@/,'');
    const{data,error}=await sb.functions.invoke('publish-telegram',{body:{action:'verify_channel',channel}});
    if(error)throw error;
    const checks=data?.checks||{};
    const ok=!!data?.connected;
    if($('telegramPermissionDetail'))$('telegramPermissionDetail').textContent=`Bot ${checks.bot_authenticated?'✓':'✕'} · Channel ${checks.channel_resolved?'✓':'✕'} · Admin ${checks.is_admin?'✓':'✕'} · Can post ${checks.can_post?'✓':'✕'}`;
    if($('telegramVerifyMessage'))$('telegramVerifyMessage').textContent=ok?`Connected as @${data?.bot?.username||'bot'} to ${data?.channel||channel}`:(data?.error||'Telegram permissions are incomplete.');
    if($('telegramPublishStatus')){$('telegramPublishStatus').textContent=ok?'CONNECTED':'PERMISSION REQUIRED';$('telegramPublishStatus').className='pill '+(ok?'':'orange')}
    await loadPublishingAccounts();
  }catch(e){
    if($('telegramPermissionDetail'))$('telegramPermissionDetail').textContent='Verification failed';
    if($('telegramVerifyMessage'))$('telegramVerifyMessage').textContent=e?.message||String(e);
  }finally{btn.disabled=false;btn.textContent=old}
}
async function publishGeneratedToTelegram(){
  const btn=$('publishTelegram');
  const text=$('generatedPost').value.trim();
  if(!text){alert('Generate or enter content first.');return}
  const account=allPublishingAccounts.find(x=>x.connection_status==='connected')||allPublishingAccounts[0];
  if(!account){alert('No Telegram publishing account is configured yet. Add the channel in Supabase publishing_accounts after connecting the bot.');return}
  if(!confirm(`Publish this content now to ${account.account_name||account.username||'Telegram'}?`))return;
  const old=btn.textContent;btn.disabled=true;btn.textContent='Publishing…';
  try{
    const{data:{user}}=await sb.auth.getUser();
    const{data:q,error:qErr}=await sb.from('publishing_queue').insert({platform:'telegram',publishing_account_id:account.id,content_text:text,status:'approved',created_by:user?.id||null}).select('id').single();
    if(qErr)throw qErr;
    const{data,error}=await sb.functions.invoke('publish-telegram',{body:{action:'publish',queue_id:q.id}});
    if(error)throw error;if(!data?.ok)throw new Error(data?.error||'Telegram publish failed');
    $('postModalSub').innerHTML=`Published to Telegram${data.published_url?` · <a target="_blank" rel="noopener" href="${esc(data.published_url)}">Open post ↗</a>`:''}`;
    btn.textContent='Published ✓';
    setTimeout(()=>{btn.textContent=old;btn.disabled=false},1800);
  }catch(e){
    $('postModalSub').textContent=`Telegram publish failed: ${e?.message||e}`;
    btn.disabled=false;btn.textContent=old;
  }
}
if($('verifyTelegramConnection'))$('verifyTelegramConnection').onclick=verifyTelegramConnection;
if($('publishTelegram'))$('publishTelegram').onclick=publishGeneratedToTelegram;
'''
s=s.replace("$('regeneratePost').onclick=()=>{const x=window.lastGenerationRequest;if(x)generatePost(x.i,x.channel,$('regeneratePost'))};", "$('regeneratePost').onclick=()=>{const x=window.lastGenerationRequest;if(x)generatePost(x.i,x.channel,$('regeneratePost'))};\n"+publish_js,1)

p.write_text(s)
print('dashboard telegram publishing v6 patched')
