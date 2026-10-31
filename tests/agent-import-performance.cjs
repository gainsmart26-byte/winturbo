const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

test('browser sends sequential 5,000-row batches and reports partial failure safely',async()=>{
 const source=fs.readFileSync('leads-intell.js','utf8');
 const importSource=source.slice(source.indexOf('async function importItems('),source.indexOf('  async function importLeads('));
 const calls=[],messages=[];
 const context=vm.createContext({ready:true,agentMode:true,message:text=>messages.push(text),gateway:async body=>{calls.push(body);return {added:body.items.length,skipped:0,invalid:0}}});
 vm.runInContext(importSource,context);
 const items=Array.from({length:10501},(_,n)=>({phone:String(8000000000+n)}));
 const result=await context.importItems(items,'Referral');
 assert.equal(result.added,10501);assert.deepEqual(calls.map(c=>c.items.length),[5000,5000,501]);
 assert.ok(calls.every(c=>c.source==='Referral'));
 assert.equal(new Set(calls.flatMap(c=>c.items.map(i=>i.phone))).size,10501);
 assert.match(messages.at(-1),/10,501 of 10,501/);
 let requests=0;context.gateway=async body=>{if(++requests===2)throw Error('network failed');return {added:body.items.length,skipped:0}};
 await assert.rejects(context.importItems(items),/5000 leads imported before the error/);
 assert.equal(requests,2,'A failed mutation must not be automatically retried');
});

// Run the real gateway against the existing in-memory database fixture. Count
// database round trips rather than assuming a particular production latency.
function fixture(source,metrics){
 const testSource=fs.readFileSync('tests/leads-agent-gateway.test.cjs','utf8').split(" test('gateway")[0];
 const instrumented=testSource.replace('range:async(a,b)=>({data:apply().slice(a,b+1)})',
  'range:async(a,b)=>{metrics.reads++;return {data:apply().slice(a,b+1)}}');
 const fakeRequire=name=>name==='node:fs'?{readFileSync:(path,...args)=>path==='supabase/functions/leads-agent-gateway/index.ts'?source:fs.readFileSync(path,...args)}:require(name);
 return new Function('require','metrics',instrumented+';return fixture();')(fakeRequire,metrics);
}

test('5,000-lead batches accept the limit, reject overflow, and preserve retry safety',async()=>{
 const source=fs.readFileSync('supabase/functions/leads-agent-gateway/index.ts','utf8'),m={reads:0},f=fixture(source,m);
 const items=Array.from({length:5000},(_,n)=>({phone:String(8000000000+n)}));
 const result=await f.invoke({action:'import',items});
 assert.equal(result.status,200);assert.equal(result.body.added,5000);
 const again=await f.invoke({action:'import',items});
 assert.equal(again.body.added,0);assert.equal(again.body.skipped,5000);
 assert.equal((await f.invoke({action:'import',items:[...items,items[0]]})).status,400);
});

test('15,000-lead upload uses at least 5x fewer identity read trips than the old 100-row flow',async()=>{
 const current=fs.readFileSync('supabase/functions/leads-agent-gateway/index.ts','utf8');
 const baseline=current.replace('body.items.length>5000','body.items.length>100');
 async function run(source,size){
  const metrics={reads:0,requests:0},f=fixture(source,metrics);
  // Duplicate-heavy real-world re-uploads still used to scan both full tables
  // per 100 rows. Keep the dataset stable to isolate batch overhead.
  const items=Array.from({length:15000},()=>({phone:'9876543210'}));
  const start=performance.now();
  for(let n=0;n<items.length;n+=size){metrics.requests++;await new Promise(resolve=>setTimeout(resolve,10));const r=await f.invoke({action:'import',items:items.slice(n,n+size)});assert.equal(r.status,200);assert.equal(r.body.added,0)}
  return {...metrics,elapsed_ms:Math.round(performance.now()-start)};
 }
 const before=await run(baseline,100),after=await run(current,5000);
 assert.equal(before.requests,150);assert.equal(after.requests,3);
 assert.ok(before.reads/after.reads>=5);
 console.log(JSON.stringify({benchmark:'15000 duplicate leads; real gateway, in-memory DB, simulated 10ms request latency',before,after,request_reduction:before.requests/after.requests,identity_read_reduction:before.reads/after.reads}));
});
