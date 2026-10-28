/* Shared lead identity, spreadsheet and callback rules. */
(function(root){
  const responses=['Disconnected','Message Sent','Connected Not Interested','Need Offer','Call Back'];
  const phone=v=>{let s=String(v??'').trim().replace(/^'/,'').replace(/[\s()+.-]/g,'');if(s.startsWith('0091')&&s.length===14)s=s.slice(2);if(s.length===12&&s.startsWith('91'))s=s.slice(2);return /^\d{7,15}$/.test(s)?s:''};
  const username=v=>{const s=String(v??'').trim();return /^[A-Za-z0-9_.@-]{1,100}$/.test(s)?s:''};
  const day=(v=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
  function merge(players,records){
    const rows=players.map(p=>({...p,key:'user:'+p.username.toLowerCase(),source:'Registered',registration:'Registered',record:null}));
    const users=new Map(rows.map(r=>[r.username.toLowerCase(),r])),phones=new Map();
    for(const r of rows){const p=phone(r.phone);if(p)phones.set(p,phones.has(p)?null:r)}
    // A saved registered identity takes priority; phone-only uploads link only to a unique match.
    for(const record of records){const number=phone(record.phone);let r=(record.username?users.get(record.username.toLowerCase()):null)||phones.get(number);
      if(!r){r={key:record.lead_key,username:record.username,phone:record.phone,source:'Manual',registration:number&&phones.has(number)&&phones.get(number)===null?'Review needed':'Unregistered',record:null};rows.push(r)}
      if(!r.record||new Date(record.updated_at)>new Date(r.record.updated_at))r.record=record;
    }
    return rows;
  }
  function attachWati(leads,contacts){
    const byPhone=new Map();
    for(const lead of leads){lead.wati_connection_ids=[...new Set((lead.record?.tags||[]).filter(t=>t.startsWith('WATI:')).map(t=>t.slice(5)))];const p=phone(lead.phone);if(p){if(!byPhone.has(p))byPhone.set(p,[]);byPhone.get(p).push(lead)}}
    for(const contact of contacts){const p=phone(contact.phone);if(!p)continue;let matches=byPhone.get(p);if(!matches){const lead={key:'phone:'+p,username:null,phone:p,source:'WATI',registration:'Unregistered',record:null,created_at:contact.contact_created_at||contact.first_seen_at,wati_connection_ids:[]};leads.push(lead);matches=[lead];byPhone.set(p,matches)}for(const lead of matches){if(!lead.wati_connection_ids.includes(contact.connection_id))lead.wati_connection_ids.push(contact.connection_id)}}
    return leads;
  }
  function parseRows(rows){
    if(!rows.length)return {items:[],invalid:0,duplicates:0};
    const header=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const headers=rows[0].map(header),pi=headers.findIndex(x=>['phone','phoneno','phonenumber','mobile','mobileno','mobilenumber'].includes(x)),ui=headers.findIndex(x=>['username','user','userid'].includes(x));
    const hasHeader=pi>=0||ui>=0,items=[],seen=new Set();let invalid=0,duplicates=0;
    for(const row of rows.slice(hasHeader?1:0)){
      if(row.every(v=>!String(v??'').trim()))continue;
      let p='',u='';
      if(hasHeader){p=pi>=0?phone(row[pi]):'';u=ui>=0?username(row[ui]):'';if((pi>=0&&String(row[pi]??'').trim()&&!p)||(ui>=0&&String(row[ui]??'').trim()&&!u)){invalid++;continue}}
      else {const value=row[0];p=phone(value);if(!p)u=username(value)}
      if(!p&&!u){invalid++;continue}
      const key=u?'user:'+u.toLowerCase():'phone:'+p;
      if(seen.has(key)){duplicates++;continue}seen.add(key);items.push({lead_key:key,username:u||null,phone:p||null});
    }
    return {items,invalid,duplicates};
  }
  const api={responses,phone,username,day,merge,attachWati,parseRows};root.LeadsIntellCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

