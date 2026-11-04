const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('dashboard.html','utf8');const sections=html.match(/const SECTIONS=\[[\s\S]*?\n  \];/)[0],allowed=html.match(/function allowedSet\(ctx\)\{[\s\S]*?\n  \}/)[0];const ctx=vm.createContext({Set});vm.runInContext(sections+'\n'+allowed+'\nthis.allowedSet=allowedSet',ctx);
assert(ctx.allowedSet({access_level:'section',allowed_sections:['leadsIntell','whatsappIntelligence']}).has('whatsappIntelligence'));
assert(!ctx.allowedSet({access_level:'section',allowed_sections:['leadsIntell']}).has('whatsappIntelligence'));
assert(!ctx.allowedSet({access_level:'section',allowed_sections:['leadsIntell','whatsappIntelligence']}).has('userAccess'));
console.log('PASS granted WhatsApp tab preserved; ungranted WhatsApp and administrator sections remain excluded');
