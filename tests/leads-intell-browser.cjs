// Run with node tests/leads-intell-browser.cjs (Playwright required).
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.LEADS_TEST_CHROMIUM?{executablePath:process.env.LEADS_TEST_CHROMIUM}:{})});try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="app"><nav class="nav"></nav><main class="main"><h1 id="title"></h1><section id="other" class="section"></section></main></div>');
  await page.addStyleTag({path:path.resolve('leads-intell.css')});
  await page.evaluate(()=>{
    window.testPlayers=Array.from({length:501},(_,i)=>({username:'user'+i,phone:String(9876543200+i),ftd:i===0,lifetime_deposits:i===0?100:0,deposit_count:i===0?1:0}));window.testRecords=[];window.ranges=[];
    window.sb={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},from(table){let payload;const q={select(){return q},eq(){return q},order(){return q},maybeSingle:async()=>({data:{role:'admin',is_active:true}}),range:async(a,b)=>{window.ranges.push([table,a,b]);return {data:(table==='admin_players'?window.testPlayers:window.testRecords).slice(a,b+1)}},upsert(value,options){payload=value;q.options=options;return q},single:async()=>{const row={...payload};window.testRecords=window.testRecords.filter(x=>x.lead_key!==row.lead_key);window.testRecords.push(row);return {data:row}},then(resolve){const values=Array.isArray(payload)?payload:[payload];let added=[];for(const x of values){if(q.options?.ignoreDuplicates&&window.testRecords.some(r=>r.lead_key===x.lead_key))continue;const row={...x,updated_at:new Date().toISOString()};window.testRecords.push(row);added.push(row)}return Promise.resolve({data:added}).then(resolve)}};return q}};
  });
  await page.addScriptTag({path:path.resolve('vendor/xlsx.full.min.js')});
  await page.addScriptTag({path:path.resolve('leads-intell-core.js')});await page.addScriptTag({path:path.resolve('leads-intell.js')});
  await page.waitForSelector('[data-s="leadsIntell"]');await page.click('[data-s="leadsIntell"]');await page.waitForFunction(()=>document.querySelector('#leadCount').textContent.startsWith('501'));
  assert.ok(await page.evaluate(()=>window.ranges.some(([t,a])=>t==='admin_players'&&a===500)));
  await page.selectOption('#leadDeposit','none');assert.match(await page.textContent('#leadCount'),/^500 /);
  await page.selectOption('#leadDeposit','');await page.fill('#leadSearch','user0');await page.click('#leadRows button');assert.equal(await page.isVisible('#leadCallbackDate'),false);
  await page.selectOption('#leadResponse','Call Back');assert.equal(await page.isVisible('#leadCallbackDate'),true);
  const day=await page.evaluate(()=>LeadsIntellCore.day(new Date(Date.now()+86400000)));await page.fill('#leadCallbackDate',day);await page.fill('#leadCallbackTime','15:30');await page.fill('#leadNotes','Follow up');await page.click('#leadSave');await page.waitForFunction(()=>!document.querySelector('#leadEditor').open);
  const saved=await page.evaluate(()=>window.testRecords[0]);assert.equal(saved.response,'Call Back');assert.equal(saved.callback_at,day+'T10:00:00.000Z');
  await page.click('#leadRows button');await page.selectOption('#leadResponse','Message Sent');await page.click('#leadSave');await page.waitForFunction(()=>!document.querySelector('#leadEditor').open);assert.equal(await page.evaluate(()=>window.testRecords[0].callback_at),null);
  await page.locator('summary').click();await page.setInputFiles('#leadFile',{name:'leads.csv',mimeType:'text/csv',buffer:Buffer.from('Phone,Username\n7777777777,newlead\n,otherlead\nnope,bad\n')});await page.waitForFunction(()=>document.querySelector('#leadImportPreview').textContent.includes('2 valid leads'));await page.click('#leadImport');await page.waitForFunction(()=>window.testRecords.length===3);assert.equal(await page.evaluate(()=>window.testRecords[0].response),'Message Sent');
  await page.evaluate(()=>{window.testRecords[0].response='Call Back';window.testRecords[0].callback_at=new Date(Date.now()-86400000).toISOString()});await page.click('#leadRefresh');await page.waitForSelector('#leadViewReminders');await page.click('#leadViewReminders');await page.waitForFunction(()=>document.querySelector('#leadCount').textContent.startsWith('1 '));
  assert.equal(await page.inputValue('#leadSearch'),'');assert.deepEqual(errors,[]);console.log('PASS: pagination, filters, callback editor/save, Excel reader/CSV upload, preserved responses and overdue reminders');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
