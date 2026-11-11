const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module'),{webcrypto}=require('node:crypto');
let handoffTranslation='',handler,auth=null,oldOwner=null,oldSession=false,quota=true,lookupCount=0,ambiguous=false,aiCalls=0,contactMissing=false;const writes=[],provider=[];
const settings={enabled:true,allowed_origins:['winturbo.com'],access_mode:'domain',system_instructions:''};
const db={auth:{getUser:async t=>({data:{user:t==='valid'?auth:null},error:t==='valid'?null:{}})},rpc:async(name,args)=>{if(name==='turboman_take_quota')return {data:quota};if(name==='turboman_search_knowledge')return {data:[{id:'knowledge-1',title:'Confirmed support policy',content:'Use support.'}]};lookupCount++;assert.equal(args.p_phone,'919876543210');return {data:contactMissing?[]:ambiguous?[{username:'one'},{username:'two'}]:[{username:'own-user',synced_at:'2026-11-03T19:00:00Z'}]};},from(table){let op='read',value;const q={select(){return q},eq(){return q},neq(){return q},order(){return q},insert(v){op='insert';value=v;return q},update(v){op='update';value=v;return q},async maybeSingle(){return {data:table==='chatbot_settings'?settings:oldSession?{id:'old-session',verified_user_id:oldOwner}:null}},async single(){writes.push({table,value});return {data:{id:'new-session'}}},limit(){return q},then(resolve){if(op!=='read')writes.push({table,value});resolve({data:table==='chatbot_messages'?[{role:'user',content:'मेरा बैलेंस'}]:[],error:null})}};return q;}};
const ctx=vm.createContext({crypto:webcrypto,TextEncoder,Uint8Array,URL,Request,Response,AbortSignal,createClient:()=>db,Deno:{env:{get:k=>k==='OPENAI_API_KEY'?'main-secret-key':'test'},serve:f=>handler=f},fetch:async(url,opts)=>{if(url.endsWith('/auth/v1/settings'))return Response.json({external:{phone:false}});const b=JSON.parse(opts.body);provider.push(b);if(url.endsWith('client_secrets'))return Response.json({value:'ephemeral-test',expires_at:1});if(b.instructions?.startsWith('Translate')&&handoffTranslation)return Response.json({output_text:handoffTranslation});if(b.instructions?.startsWith('Classify'))return Response.json({output_text:JSON.stringify({language:'Hindi',topic:'account',knowledge_gap:false})});aiCalls++;return Response.json(aiCalls%2?{output:[{type:'function_call',name:'get_my_account',call_id:'call-1',arguments:'{}'}]}:{output:[{content:[{type:'output_text',text:'सुरक्षित सत्यापन आवश्यक है।'}]}]});}});
vm.runInContext(stripTypeScriptTypes(fs.readFileSync('supabase/functions/turboman-support/index.ts','utf8').replace(/^import .*;$/gm,'')),ctx);
const body={message:'मेरा बैलेंस',visitor_id:'customer-test-12345678',session_id:'00000000-0000-4000-8000-000000000001',language:'Hindi'};
async function call(b=body,token='',origin='https://winturbo.com'){const r=await handler(new Request('https://example.test',{method:'POST',headers:{origin,...token?{authorization:'Bearer '+token}:{}},body:JSON.stringify(b)}));return {status:r.status,data:await r.json()};}
(async()=>{
assert.equal((await call(body,'','https://evil.example')).status,403);assert.equal((await call(body,'bad')).status,401);quota=false;assert.equal((await call()).status,429);quota=true;
oldSession=true;oldOwner='different-user';writes.length=0;const guest=await call();assert.equal(guest.status,200);assert.equal(guest.data.verification_required,true);assert.equal(lookupCount,0);assert(writes.some(w=>w.table==='chatbot_sessions'&&w.value?.verified_user_id===null));assert(!JSON.stringify(guest).includes('own-user'));
auth={id:'user-1',phone:'+919876543210',phone_confirmed_at:null};aiCalls=0;await call(body,'valid');assert.equal(lookupCount,0);
auth.phone_confirmed_at='2026-11-03';aiCalls=0;await call(body,'valid');assert.equal(lookupCount,1);assert(provider.some(b=>Array.isArray(b.input)&&b.input.some(x=>x.type==='function_call_output'&&x.output.includes('own-user'))));
ambiguous=true;aiCalls=0;provider.length=0;await call(body,'valid');assert(provider.some(b=>Array.isArray(b.input)&&b.input.some(x=>x.type==='function_call_output'&&x.output.includes('Multiple accounts'))));assert(!provider.some(b=>JSON.stringify(b).includes('"username":"one"')));
writes.length=0;const recorded=await call({...body,action:'voice_transcript',channel:'voice',role:'user',transcript:'नमस्ते',event_id:'item_123'});assert.equal(recorded.status,200);assert(writes.some(w=>w.value?.record_type==='spoken_transcript'));assert.equal((await call({...body,action:'voice_transcript',role:'system',transcript:'fake',event_id:'item_123'})).status,400);
const voice=await call({...body,action:'voice_token'});assert.equal(voice.status,200);assert.equal(voice.data.client_secret,'ephemeral-test');assert(!JSON.stringify(voice).includes('main-secret-key'));const voiceBody=provider.find(b=>b.session);assert.equal(voiceBody.session.tools[0].name,'support_question');assert(!JSON.stringify(voiceBody).includes('own-user'));
const handoff=await call({...body,action:'handoff',language:'English'});
assert.equal(handoff.data.handoff,true);
assert.equal(handoff.data.handoff_phone,'+919205098663');
assert.match(handoff.data.answer,/\+919205098663/);
handoffTranslation='WhatsApp +1 (254) 428-9850 or https://wa.me/12544289850. Previous contacts: +91 83688 87218 and +91 78276 16252. Most recent: https://wa.me/639129604491. Last number: +44 7366 674336.';
const translatedHandoff=await call({...body,action:'handoff'});
assert.equal(translatedHandoff.data.answer,'WhatsApp +919205098663 or https://wa.me/919205098663. Previous contacts: +919205098663 and +919205098663. Most recent: https://wa.me/919205098663. Last number: +919205098663.');
handoffTranslation='';
assert(writes.some(w=>w.value?.handoff_requested===true));auth=null;oldSession=true;oldOwner=null;ambiguous=false;writes.length=0;provider.length=0;aiCalls=0;
const contact=await call({...body,contact_phone:'+91 98765 43210'});
assert.equal(contact.status,200);assert.equal(contact.data.verification_required,true);
assert(writes.some(w=>w.table==='chatbot_sessions'&&w.value?.contact_phone==='919876543210'&&w.value?.contact_phone_source==='registered_match'&&w.value?.verified_user_id===null));
assert(!JSON.stringify(provider).includes('own-user'));assert(!JSON.stringify(contact).includes('919876543210'));
contactMissing=true;writes.length=0;aiCalls=0;await call({...body,contact_phone:'9876543210'});
assert(!writes.some(w=>w.value?.contact_phone));
console.log('PASS origin, rate limits, expired/unconfirmed identity, session isolation, exact verified account lookup, ambiguity, voice credential scope and handover persistence');
})().catch(e=>{console.error(e);process.exitCode=1});

