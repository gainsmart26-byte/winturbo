const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {stripTypeScriptTypes}=require('module');
const core=fs.readFileSync(__dirname+'/../supabase/functions/stringeex-call-sync/call-core.js','utf8').replace(/export /g,'');
const c={};vm.createContext(c);vm.runInContext(core+';this.normalize=normalize;this.phone=phone;this.analytics=analytics;',c);
for(const p of ['9876543210','919876543210','+91 98765 43210','00919876543210'])assert.equal(c.phone(p),'9876543210');
const sample={direction:0,id:'call-1',customer_number:'+919876543210',start_time:1792660000000,end_time:1792660060000,account:'ac_1',account_name:'Agent',status:1,talk_duration:42};
assert.equal(c.normalize(sample).duration_seconds,60);assert.equal(c.normalize(sample).talk_seconds,42);assert.equal(c.normalize(sample).status,'Answered');assert.equal(c.normalize({...sample,direction:1}),null);assert.equal(c.normalize({...sample,status:2,end_call_reason:'USER_BUSY'}).status,'Busy');assert.equal(c.normalize({...sample,status:2,end_call_reason:'USER_NOT_ANSWERED'}).status,'Unanswered');assert.equal(c.normalize({...sample,customer_number:'sip:invalid'}),null);
let handler,tables={},identity={id:'agent1'};
function query(table){let filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},ilike(k,v){filters.push(r=>r[k]?.toLowerCase()===v.toLowerCase());return q},order(){return q},range(){return q},limit(){return q},maybeSingle(){return Promise.resolve({data:(tables[table]||[]).find(r=>filters.every(f=>f(r)))||null})},single(){return q.maybeSingle()},then(resolve){return Promise.resolve({data:(tables[table]||[]).filter(r=>filters.every(f=>f(r)))}).then(resolve)}};return q}
const db={auth:{getUser:async()=>({data:{user:identity}})},from:query};
const source=stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/stringeex-call-sync/index.ts','utf8').replace(/^import .*;\n/gm,''));
const sandbox={createClient:()=>db,Deno:{env:{get:()=>''},serve:f=>handler=f},Response,Request,AbortSignal,URLSearchParams,console,phone:c.phone,normalize:c.normalize,analytics:c.analytics,fetch:()=>{throw Error('Unexpected external request')}};vm.runInNewContext(source,sandbox);
async function request(body,auth=true){const response=await handler(new Request('https://example.test',{method:'POST',headers:auth?{Authorization:'Bearer fake'}:{},body:JSON.stringify(body)}));return [response.status,await response.json()]}
(async()=>{
 assert.equal((await request({action:'history'},false))[0],401);
 tables.profiles=[{id:'agent1',role:'viewer',is_active:true}];
 for(const action of ['connect','settings','sync','link','analytics'])assert.equal((await request({action}))[0],403);
 tables.leads_agents=[{user_id:'agent1',name:'Caller',is_active:true}];tables.user_access_grants=[{user_id:'agent1',is_active:true,access_level:'section',allowed_sections:['leadsIntell']}];
 tables.leads_agent_sessions=[{user_id:'agent1',lead_key:'user:customer',edit_token:'valid',expires_at:new Date(Date.now()+60000).toISOString()}];tables.admin_players=[{username:'customer',phone:'919876543210'}];tables.stringeex_connection=[{id:1,last_synced_at:'2026-10-22T00:00:00Z'}];tables.stringeex_calls=[{call_id:'yes',phone:'9876543210',agent_name:'Caller'},{call_id:'other',phone:'9999999999'}];tables.stringeex_agent_links=[];
 assert.equal((await request({action:'history',edit_token:'wrong',phone:'9999999999'}))[0],403);
 const result=await request({action:'history',edit_token:'valid',phone:'9999999999'});assert.equal(result[0],200);assert.equal(result[1].calls.length,1);assert.equal(result[1].calls[0].call_id,'yes');
 tables.leads_agent_sessions[0].expires_at='2020-01-01';assert.equal((await request({action:'history',edit_token:'valid'}))[0],403);
 tables.profiles[0].role='admin';const report=await request({action:'analytics'});assert.equal(report[0],200);assert.equal(report[1].stats.numbers,1);
 console.log('PASS: phone normalization, call outcomes, durations, inbound exclusion, authentication, admin-only actions, agent session expiry and cross-lead isolation');
})().catch(e=>{console.error(e);process.exit(1)});
