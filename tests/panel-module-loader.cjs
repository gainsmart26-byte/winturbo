const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const timers=[],listeners={},mounted=new Set();let userCalls=0,profileCalls=0,fail=true;
 const context={window:{addEventListener:(event,fn)=>listeners[event]=fn},document:{getElementById:id=>mounted.has(id)?{}:null,addEventListener:(event,fn)=>listeners[event]=fn},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},console:{warn(){}},sb:{auth:{getUser:async()=>{userCalls++;return {data:{user:{id:'admin'}}}}},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>{profileCalls++;return fail?{error:Error('Temporary database failure')}:{data:{role:'admin',is_active:true}}}})}};
 vm.runInNewContext(fs.readFileSync('panel-module-loader.js','utf8'),context);
 const w=context.window;
 const a=w.WinTurboLoadProfile(),b=w.WinTurboLoadProfile();assert.equal(a,b);await assert.rejects(a,/Temporary/);assert.equal(userCalls,1);assert.equal(profileCalls,1);
 fail=false;assert.equal((await w.WinTurboLoadProfile()).profile.role,'admin');
 let attempts=0;w.WinTurboRegisterModule('adminIntelligence',async()=>{attempts++;if(attempts===1)throw Error('Transient');mounted.add('adminIntelligence')});
 await timers.pop()();assert.equal(attempts,1);await timers.pop()();assert.equal(attempts,2);assert.ok(mounted.has('adminIntelligence'));
 await listeners.online();assert.equal(attempts,2);
 let denied=0;w.WinTurboRegisterModule('restricted',async()=>{denied++});await timers.pop()();assert.ok(!mounted.has('restricted'));assert.equal(denied,1);
 console.log('PASS: shared role request, retry after failure, recovered module mounts once, mounted tabs preserved, denied module stays absent');
})().catch(e=>{console.error(e);process.exitCode=1});
