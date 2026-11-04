/* Phone matching is a page entry filter, never proof of account ownership. */
(()=>{
 const gate=document.getElementById('vipGate'),form=document.getElementById('vipPhoneForm'),phone=document.getElementById('vipPhone'),status=document.getElementById('vipGateStatus'),registration=document.getElementById('vipRegistration'),submit=document.getElementById('vipContinue');
 let busy=false;
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  busy=true;submit.disabled=true;registration.hidden=true;status.textContent='Checking your registration…';
  try{
   const response=await fetch('https://kxspsqtdvngiovjvskuq.supabase.co/functions/v1/vip-access',{method:'POST',headers:{'Content-Type':'application/json',apikey:'sb_publishable_mY0ClcO6rmkXBE9ppsX5ew_IFQ4jvD8'},body:JSON.stringify({phone:phone.value}),signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Could not check registration. Please try again.');
   if(data.registered!==true){status.textContent='This number was not found in our registered member records. If you just registered, please try again after the records update.';registration.hidden=false;document.getElementById('vipRegisterLink').focus();return;}
   document.body.classList.add('vip-unlocked');gate.hidden=true;phone.value='';
   document.querySelectorAll('[data-vip-content]').forEach(el=>{el.hidden=false;el.inert=false});
   // Load the chat only after the entry check. No identity or account token is created.
   const widget=document.createElement('script');widget.src='/turboman-embed.js';widget.dataset.open='true';widget.dataset.inline='true';widget.dataset.memberLogin='true';widget.dataset.container='chatMount';document.body.appendChild(widget);
   document.getElementById('memberLogin').focus();
  }catch(error){status.textContent=error.name==='TimeoutError'?'The check timed out. Please try again.':error.message;}
  finally{busy=false;submit.disabled=false;}
 });
})();
