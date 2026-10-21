const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../leads-intell-core.js');
test('normalizes Indian phones without guessing invalid or scientific values',()=>{
  assert.equal(C.phone('+91 98765 43210'),'9876543210');
  assert.equal(C.phone('00919876543210'),'9876543210');
  assert.equal(C.phone('9.87654E+09'),'');
  assert.equal(C.phone('call me'),'');
});
test('imports phone and username headers, rejects malformed rows and deduplicates',()=>{
  const r=C.parseRows([['Phone Number','Username'],['+91 9876543210','Alice'],['9876543210','alice'],['bad','bob'],['8888888888',''],['','']]);
  assert.equal(r.items.length,2);assert.equal(r.duplicates,1);assert.equal(r.invalid,1);
  assert.equal(r.items[0].lead_key,'user:alice');
  assert.equal(C.parseRows([['9876543210'],['someone']]).items.length,2);
});
test('includes nondepositors and merges phone leads without dropping saved response',()=>{
  const records=[{lead_key:'phone:9876543210',phone:'9876543210',response:'Need Offer',updated_at:'2026-01-01'}];
  const rows=C.merge([{username:'Alice',phone:'+919876543210',ftd:false,lifetime_deposits:0},{username:'Bob',ftd:true,lifetime_deposits:100}],records);
  assert.equal(rows.length,2);assert.equal(rows[0].record.response,'Need Offer');assert.equal(rows[0].key,'user:alice');
  assert.equal(C.merge([{username:'A',phone:'9876543210'},{username:'B',phone:'9876543210'}],records).length,3);
});
test('callback day uses IST across the UTC midnight boundary',()=>{
  assert.equal(C.day('2026-10-19T20:00:00Z'),'2026-10-20');
});
test('source counts deduplicate country-code variants and preserve WATI attribution',()=>{
  const rows=[{source:'Registered',phone:'+919876543210',wati:true,record:{lead_source:'Manual'}},{source:'Manual',phone:'9876543210',record:{lead_source:'WATI'}},{source:'Registered',phone:'918888888888',record:{lead_source:'Manual'}},{source:'Manual',phone:'7777777777'},{source:'Manual',phone:null}];
  assert.equal(C.countNumbers(rows),3);
  assert.equal(C.countNumbers(rows.filter(x=>C.matchesSource(x,'WATI'))),1);
  assert.equal(C.countNumbers(rows.filter(x=>C.matchesSource(x,'Manual'))),2);
  assert.equal(C.countNumbers(rows.filter(x=>C.matchesSource(x,'Registered'))),2);
  assert.equal(C.countNumbers([]),0);
});
