// Run with jsdom available: NODE_PATH=<node_modules> node tests/leads-intell-dom.cjs
const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const XLSX=require('../vendor/xlsx.full.min.js');
const wait=async(check)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,30))}throw Error('Timed out waiting for UI')};
(async()=>{
 const dom=new JSDOM('<div id="app"><nav class="nav"></nav><main class="main"><h1 id="title"></h1><section class="section"></section></main></div>',{runScripts:'outside-only',url:'https://example.test'}),w=dom.window,d=w.document,errors=[];
 try{
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.addEventListener('error',e=>errors.push(e.message));
 const players=Array.from({length:501},(_,i)=>({username:'user'+i,phone:String(9876543200+i),ftd:i===0,lifetime_deposits:i===0?100:0,deposit_count:i===0?1:0}));let records=[],ranges=[];
 w.sb={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},from(table){let payload,options;const q={select(){return q},eq(){return q},order(){return q},maybeSingle:async()=>({data:{role:'admin',is_active:true}}),range:async(a,b)=>{ranges.push([table,a,b]);return {data:(table==='admin_players'?players:records).slice(a,b+1)}},upsert(value,opts){payload=value;options=opts;return q},single:async()=>{const row={...payload};records=records.filter(x=>x.lead_key!==row.lead_key);records.push(row);return {data:row}},then(resolve){const values=Array.isArray(payload)?payload:[payload];let added=[];for(const x of values){if(options?.ignoreDuplicates&&records.some(r=>r.lead_key===x.lead_key))continue;const row={...x,updated_at:new Date().toISOString()};records.push(row);added.push(row)}return Promise.resolve({data:added}).then(resolve)}};return q}};
 for(const file of ['vendor/xlsx.full.min.js','leads-intell-core.js','leads-intell.js'])w.eval(fs.readFileSync(file,'utf8'));
 const $=id=>d.getElementById(id),change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('change'))},save=()=> $('leadForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
 await wait(()=>$('leadCount')?.textContent.startsWith('501'));d.querySelector('[data-s="leadsIntell"]').click();await wait(()=>!$('leadRefresh').disabled);
 assert.ok(ranges.some(([table,start])=>table==='admin_players'&&start===500));change('leadDeposit','none');assert.match($('leadCount').textContent,/^500 /);
 change('leadDeposit','');$('leadSearch').value='user0';$('leadSearch').dispatchEvent(new w.Event('input'));d.querySelector('#leadRows button').click();assert.equal($('leadCallbackFields').hidden,true);
 change('leadResponse','Call Back');assert.equal($('leadCallbackFields').hidden,false);const day=w.LeadsIntellCore.day(Date.now()+86400000);$('leadCallbackDate').value=day;$('leadCallbackTime').value='15:30';save();await wait(()=>!$('leadEditor').open);assert.equal(records[0].callback_at,day+'T10:00:00.000Z');
 d.querySelector('#leadRows button').click();change('leadResponse','Message Sent');save();await wait(()=>!$('leadEditor').open);assert.equal(records[0].callback_at,null);
 // Real XLSX workbook through the same file-upload and preview path as the UI.
 const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Phone','Username'],['7777777777','newlead'],['','otherlead'],['bad','badlead']]),'Leads');const bytes=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
 Object.defineProperty($('leadFile'),'files',{value:[{size:bytes.length,arrayBuffer:async()=>new w.Uint8Array(bytes).buffer}]});$('leadFile').dispatchEvent(new w.Event('change'));await wait(()=>$('leadImportPreview').textContent.includes('2 valid leads'));assert.match($('leadImportPreview').textContent,/1 invalid/);$('leadImport').click();await wait(()=>records.length===3);await wait(()=>!$('leadRefresh').disabled);assert.equal(records[0].response,'Message Sent');
 records[0].response='Call Back';records[0].callback_at=new Date(Date.now()-86400000).toISOString();$('leadRefresh').click();await wait(()=>!$('leadRefresh').disabled);assert.equal($('leadReminder').hidden,false);$('leadViewReminders').click();await wait(()=>!$('leadRefresh').disabled);assert.match($('leadCount').textContent,/^1 /);assert.equal($('leadSearch').value,'');
 // Importing an existing username cannot replace its saved response.
 $('leadUsername').value='user0';$('leadAdd').click();await wait(()=>!$('leadAdd').disabled);assert.equal(records.length,3);assert.equal(records[0].response,'Call Back');assert.deepEqual(errors,[]);
 console.log('PASS: full pagination, deposit filters, callback editor/save/clear, real XLSX upload, duplicate safety and overdue reminders');
 }finally{w.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
