const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('dashboard.html','utf8');
function el(){return {value:'',textContent:'',disabled:false,style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){}}}
(async()=>{
 let parsed=0;for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/src=|application\/ld/.test(m[1]))continue;new vm.Script(m[2]);parsed++}
 assert.equal(html.split('/* WINTURBO_EXECUTIVE_V26_START */').length-1,1);
 let timer,cleared=false;const shared={window:{},sb:{auth:{signInWithPassword:async()=>({data:{user:{id:'u'}}})}},setTimeout:fn=>(timer=fn,1),clearTimeout:()=>{cleared=true}};
 vm.runInNewContext(fs.readFileSync('login-request.js','utf8'),shared);
 assert.equal((await shared.window.WinTurboPasswordLogin({})).data.user.id,'u');assert.ok(cleared);
 shared.sb.auth.signInWithPassword=()=>new Promise(()=>{});let pending=shared.window.WinTurboPasswordLogin({});timer();await assert.rejects(pending,/timed out/);
 pending=shared.window.WinTurboLoginDeadline(new Promise(()=>{}));timer();await assert.rejects(pending,/verification timed out/);
 const elements={email:el(),pass:el(),loginBtn:el(),msg:el()},handlers=[];let credentials;
 const phoneContext={window:{WinTurboPasswordLogin:async c=>(credentials=c,{data:{user:{id:'agent'}}})},document:{readyState:'loading',getElementById:id=>elements[id],addEventListener:(event,fn,capture)=>{if(event==='click'&&capture)handlers.push(fn)}},location:{hostname:'test'},setTimeout:()=>1,sb:{}};
 vm.runInNewContext(fs.readFileSync('lead-agents.js','utf8'),phoneContext);
 for(const phone of ['98765 43210','919876543210','+91 98765 43210','00919876543210']){elements.email.value=phone;await handlers[0]({target:{closest:()=>true},preventDefault(){},stopImmediatePropagation(){}});assert.equal(credentials.email,'agent-919876543210@agents.winturbo.live');assert.equal(elements.loginBtn.disabled,false)}
 let signouts=0,queryError=null,user={id:'admin',email:'admin@example.test'},grant={access_level:'admin',is_active:true},profile={role:'admin',is_active:true};
 const nav=['overview','leadsIntell','adminIntelligence','trafficStarsIntell','userAccess'].map(id=>({...el(),dataset:{s:id}}));
 const context={window:{WinTurboLoginDeadline:p=>p},document:{readyState:'loading',getElementById:id=>elements[id]||null,addEventListener(){},querySelectorAll:s=>s==='.nav button[data-s]'?nav:[],querySelector:()=>null},sb:{auth:{getUser:async()=>({data:{user}}),signOut:async()=>{signouts++}},from:table=>({select(){return this},eq(){return this},ilike(){return this},maybeSingle:async()=>({data:table==='profiles'?profile:grant,error:queryError})})},setTimeout:()=>1};
 let access=html.match(/<script>\s*\/\* WINTURBO_USER_ACCESS_V33_START \*\/([\s\S]*?)<\/script>/)[1];
 access=access.replace("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();","window.test={loadCurrentAccess,enforceAccess,applyAccessUI};");
 vm.runInNewContext(access,context);const api=context.window.test;
 assert.equal((await api.loadCurrentAccess()).access_level,'admin');api.applyAccessUI(grant);assert.ok(nav.every(x=>x.style.display===''));
 queryError=new Error('Database timeout');await assert.rejects(api.loadCurrentAccess(),/Database timeout/);await api.enforceAccess();assert.equal(signouts,0);assert.match(elements.msg.textContent,/Could not verify access/);
 queryError=null;user=null;await api.enforceAccess();assert.equal(signouts,0);
 user={id:'unauthorized',email:'no@example.test'};profile={role:'viewer',is_active:true};grant=null;await api.enforceAccess();assert.equal(signouts,1);
 console.log(`PASS: ${parsed} inline scripts; single summary; password/access deadlines; four phone formats; admin tab visibility; transient error preserves session; unauthorized user rejected`);
})().catch(e=>{console.error(e);process.exitCode=1});
