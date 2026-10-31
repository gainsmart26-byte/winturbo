const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('leads-intell.js','utf8');
function fixture(){
 const nodes=new Map(),calls=[],messages=[];let closed=0;
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,close:()=>closed++});return nodes.get(id)};
 const context=vm.createContext({$,ready:false,agentMode:true,editing:{key:'opaque-lead'},agentEditToken:'session-token',gateway:async body=>{calls.push(body);return body.action==='import'?{added:1,skipped:0,invalid:0}:{ok:true}},load:async()=>{},message:(...m)=>messages.push(m),Date,Error});
 vm.runInContext(source.slice(source.indexOf('async function save('),source.indexOf('  async function preview(')),context);
 vm.runInContext(source.slice(source.indexOf('async function importItems('),source.indexOf('  async function importLeads(')),context);
 return {context,$,calls,messages,closed:()=>closed};
}
test('agent can save an opened contact before the full list is ready',async()=>{
 const f=fixture();f.$('leadResponse').value='Message Sent';f.$('leadNotes').value='Contacted';
 await f.context.save({preventDefault(){}});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].action,'save');assert.equal(f.calls[0].edit_token,'session-token');assert.equal(f.calls[0].response,'Message Sent');
 assert.equal(f.closed(),1);assert.equal(f.$('leadSave').disabled,false);
});
test('agent can add a lead before the full list is ready',async()=>{
 const f=fixture();const r=await f.context.importItems([{phone:'8000000001'}],'Referral');
 assert.equal(r.added,1);assert.equal(f.calls[0].action,'import');assert.equal(f.calls[0].source,'Referral');
});
test('failed save keeps the editor open and displays the server error',async()=>{
 const f=fixture();f.$('leadResponse').value='Need Offer';f.context.gateway=async()=>{throw Error('Reopen this lead before saving')};
 await f.context.save({preventDefault(){}});
 assert.equal(f.closed(),0);assert.match(f.$('leadSaveMessage').textContent,/Reopen this lead/);assert.equal(f.$('leadSave').disabled,false);
});
test('admin imports still require a loaded dataset for local duplicate checking',async()=>{
 const f=fixture();f.context.agentMode=false;
 await assert.rejects(f.context.importItems([{phone:'8000000001'}]),/Refresh leads/);
 assert.equal(f.calls.length,0);
});
