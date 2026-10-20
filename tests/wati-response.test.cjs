const assert=require('node:assert/strict'),C=require('../wati-response-core.js');
const base=Date.parse('2026-10-20T00:00:00Z'),m=(id,s,owner,rest={})=>({id,created:new Date(base+s*1000).toISOString(),owner,type:'text',...rest}),now=base+3600000;
let r=C.summarize([m('b',120,true),m('a',0,false),m('c',30,false),m('d',240,false),m('e',300,true)],now);assert.equal(r.firstDelay,120000);assert.equal(r.average,90000);assert.equal(r.count,2);assert.equal(r.pending,null);
r=C.summarize([m('a',0,false),m('bot',10,true,{isFromBot:true}),m('human',180,true)],now);assert.equal(r.firstDelay,180000);assert.equal(r.automatic,base+10000);
r=C.summarize([m('a',0,false),m('bot',10,true,{type:'template'})],now);assert.equal(r.status,'Unanswered');assert.equal(r.wait,3600000);
r=C.summarize([m('out',0,true),m('a',60,false)],now);assert.equal(r.reply,null);
r=C.summarize([m('a',0,false),m('a',0,false),m('f',2,true,{statusString:'FAILED'}),m('b',60,true)],now);assert.equal(r.count,1);assert.equal(r.firstDelay,60000);
r=C.summarize([m('a',0,false),{id:'bad',created:'yesterday',owner:true}],now);assert.equal(r.status,'Incomplete message data');assert.equal(r.firstDelay,null);assert.equal(r.first,base);assert.equal(C.aggregate([r]).measured,0);
assert.equal(C.time({timestamp:'1792454400'}),1792454400000);assert.equal(C.time({created:'2026-10-20T00:00:00'}),null);
const a=C.aggregate([{first:base,firstDelay:1000,reply:base+1000,pending:null},{first:base,firstDelay:3000,reply:base+3000,pending:null},{first:base,firstDelay:null,reply:null,pending:base}]);assert.equal(a.average,2000);assert.equal(a.median,2000);assert.equal(a.unanswered,1);console.log('PASS response timings, automation exclusion, waiting time, outbound-first, deduplication, failed messages, invalid timestamps and averages');

r=C.summarize([m('a',0,false),{id:'ticket',created:'2026-10-20T00:00:30Z',eventType:'ticket'},m('b',120,true)],now);assert.equal(r.firstDelay,120000);assert.equal(r.invalid,0);
r=C.summarize([m('',0,false),m('',90,true)],now);assert.equal(r.firstDelay,90000);
console.log('PASS ticket events do not clear timings; missing IDs retain timestamp pairs; incomplete records preserve observed times but exclude KPIs');
