const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../supabase/functions/stringeex-call-sync/call-core.js','utf8').replace(/export /g,'')+';this.analytics=analytics;',context);
const t='2026-10-22T10:00:00Z';
const players=[{username:'a',phone:'919876543210',registered_at:'2026-10-20T10:00:00Z'},{username:'b',phone:'9876543211',registered_at:t},{username:'c',phone:'9876543212',registered_at:t},{username:'d',phone:null,registered_at:t},{username:'e',phone:'9876543213',registered_at:t}];
const records=[{lead_key:'user:b',username:'b',phone:'9876543211',created_at:t,lead_date:'2026-10-22',lead_source:'Imported partner'},{lead_key:'user:e',username:'e',phone:'9876543213',created_at:'2026-10-23T10:00:00Z'}];
const contacts=[{phone:'+919876543210',contact_created_at:t},{phone:'9876543210',contact_created_at:'2026-10-22T11:00:00Z'}];
const calls=[{call_id:'old',phone:'9876543210',started_at:'2026-10-22T09:59:00Z',stringeex_agent_id:'ac1',agent_name:'Stringee caller',status:'Answered'},{call_id:'first',phone:'919876543210',started_at:'2026-10-22T10:05:00Z',stringeex_agent_id:'ac1',agent_name:'Stringee caller',status:'Unanswered'},{call_id:'repeat',phone:'9876543210',started_at:'2026-10-22T10:20:00Z',stringeex_agent_id:'ac2',agent_name:'Caller 2',status:'Answered'},{call_id:'date-only',phone:'9876543211',started_at:'2026-10-22T10:10:00Z',status:'Answered'}];
const calc=filters=>context.analytics(players,records,contacts,calls,[{stringeex_id:'ac1',user_id:'id1'}],[{user_id:'id1',name:'Mapped agent'}],filters||{});
const result=calc();assert.equal(result.stats.numbers,4);assert.equal(result.stats.missing_phone,1);assert.equal(result.stats.called,2);assert.equal(result.stats.awaiting_first,2);assert.equal(result.stats.measured,1);assert.equal(result.stats.average_seconds,300);assert.equal(result.stats.median_seconds,300);assert.equal(result.buckets[0].count,1);
const a=result.rows.find(r=>r.phone==='9876543210');assert.equal(a.first_call.call_id,'first');assert.equal(a.first_call.agent_name,'Mapped agent');assert.equal(a.calls_before_arrival,1);assert.equal(a.attempts,3);assert.equal(a.arrival.basis,'WATI contact created');
assert.equal(result.rows.find(r=>r.phone==='9876543211').delay_seconds,null);assert.equal(result.rows.find(r=>r.phone==='9876543213').arrival.basis,'Registration time');
assert.equal(calc({agent:'ac2'}).stats.average_seconds,1200);assert.equal(calc({source:'WATI'}).stats.numbers,1);assert.equal(calc({from:'2026-10-23'}).stats.numbers,0);assert.equal(calc({state:'pending'}).stats.numbers,2);assert.equal(calc({state:'called'}).stats.numbers,2);
const empty=context.analytics(players,records,contacts,[],[],[]);assert.equal(empty.stats.average_seconds,null);assert.equal(empty.stats.called,0);
const before=context.analytics(players,records,contacts,[calls[0]],[],[]);assert.equal(before.rows.find(r=>r.phone==='9876543210').state,'Only calls before arrival');assert.equal(before.stats.average_seconds,null);
console.log('PASS: phone deduplication, source arrival precedence, excluded pre-arrival calls, first unanswered attempt, repeat calls, date-only exclusion, missing phone, agent mapping, filters, empty call coverage');

const manual=(created_at)=>context.analytics([],[{lead_key:'phone:9876543210',phone:'9876543210',created_at,lead_date:'2026-10-01',lead_source:'Manual'}],[],[{call_id:'m',phone:'9876543210',started_at:'2026-10-19T08:35:00Z'}],[],[]).rows[0];
assert.equal(manual('2026-10-23T18:29:59Z').arrival.at,'2026-10-19T08:30:00.000Z');
assert.equal(manual('2026-10-23T18:29:59Z').delay_seconds,300);
assert.equal(manual('2026-10-23T18:30:00Z').arrival.at,'2026-10-23T18:30:00.000Z');
assert.equal(manual('2026-10-23T18:30:00Z').first_call,null);
console.log('PASS: manual baseline, IST midnight cutoff and future upload-time precedence');

const deposited=context.analytics([{username:'paid',phone:'9876543210',lifetime_deposits:500}],[],[],[],[],[]);assert.equal(deposited.rows[0].has_deposit,true);assert.equal(context.analytics([{username:'paid',phone:'9876543210',deposit_count:1}],[],[],[],[],[],{state:'pending'}).rows.length,0);assert.equal(context.analytics([{username:'free',phone:'9876543210',lifetime_deposits:0}],[],[],[],[],[]).rows[0].has_deposit,false);console.log('PASS: deposit customers excluded from pending activation calls');
