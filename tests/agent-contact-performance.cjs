const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

test('12,000-contact all-dates redraw skips date conversion; dated redraw caches repeated timestamps',()=>{
 const source=fs.readFileSync('leads-intell.js','utf8');
 const render=source.slice(source.indexOf('function renderContacts(){'),source.indexOf("  document.addEventListener('winturbo-open-lead'"));
 const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{value:'',style:{}});return elements.get(id)};
 let dayCalls=0;
 const leads=Array.from({length:12000},(_,i)=>({key:'opaque'+i,username:'Contact'+i,phone:'xxxxx12345',source:'Manual',created_at:'2026-10-31T00:00:00Z',contact_activity:{attempted:false,last_call:null}}));
 const context=vm.createContext({$,leads,page:0,ready:true,contactCard:'noCall',contactCards:[['noCall','No Call'],['answered','Answered'],['disconnected','Disconnected'],['notInterested','Not Interested'],['followUps','Follow Ups'],['registered','Registered'],['unregistered','Unregistered']],registration:()=> 'Unregistered',leadSource:()=> 'Manual',esc:String,when:()=>'',callStatusCard:()=>'',message:()=>{},C:{day:()=>{dayCalls++;return '2026-10-31'}}});
 vm.runInContext(render,context);context.renderContacts();
 assert.equal(dayCalls,0);assert.match($('leadCount').textContent,/12,000 matching/);
 $('leadDateFrom').value='2026-10-31';context.renderContacts();
 assert.equal(dayCalls,1,'Each repeated timestamp should be converted once per render');
 assert.match($('leadCount').textContent,/12,000 matching/);
});

test('large contact page runs at most six activity lookups concurrently and keeps masking',async()=>{
 let fixtureSource=fs.readFileSync('tests/agent-contact-gateway.test.cjs','utf8').split(" test('gateway")[0];
 const metrics={active:0,max:0,lookups:0};
 fixtureSource=fixtureSource.replace('range:async(a,b)=>({data:apply().slice(a,b+1)})',`range:async(a,b)=>{const activity=['stringeex_calls','leads_edit_history'].includes(table);if(activity){metrics.active++;metrics.max=Math.max(metrics.max,metrics.active);metrics.lookups++;await new Promise(r=>setTimeout(r,2))}const data=apply().slice(a,b+1);if(activity)metrics.active--;return {data}}`);
 const f=new Function('require','metrics','setTimeout',fixtureSource+';return fixture();')(require,metrics,setTimeout);
 for(let n=0;n<5100;n++)f.getPlayers().push({username:'player'+n,phone:String(8000000000+n)});
 const first=await f.invoke({action:'list',page:0,page_size:5000,contact_view:true});
 assert.equal(first.status,200);assert.equal(first.body.rows.length,5000);assert.equal(first.body.page_size,5000);
 assert.equal(metrics.max,6);assert.equal(metrics.active,0);
 const second=await f.invoke({action:'list',page:1,page_size:5000,contact_view:true});
 assert.equal(second.body.rows.length,102);
 assert.equal(new Set([...first.body.rows,...second.body.rows].map(r=>r.key)).size,5102);
 assert.ok(first.body.rows.every(r=>/^xxxxx/.test(r.phone)&&r.contact_activity));
});
