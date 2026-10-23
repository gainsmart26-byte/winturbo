export function phone(value){
 let s=String(value??'').trim().replace(/[\s()+.\-]/g,'');
 if(s.startsWith('00'))s=s.slice(2);
 if(/^91\d{10}$/.test(s))s=s.slice(2);
 return /^\d{7,15}$/.test(s)?s:'';
}
export function normalize(row){
 // Call API logs use internal/external legs, unlike StringeeX history direction.
 if('to_number' in row){
  if(Number(row.to_internal)!==0||!(Number(row.from_internal)===1||row.from_user_id))return null;
  let number=String(row.to_number||'');try{number=decodeURIComponent(number)}catch{}
  row={...row,direction:0,customer_number:number,account:row.from_user_id||null,account_name:row.from_alias||'Unmapped StringeeX agent',end_time:row.stop_time,status:Number(row.answer_time)>0||Number(row.answer_duration)>0?1:2,talk_duration:row.answer_duration};
 }

 if(Number(row.direction)!==0)return null;
 const p=phone(row.customer_number),start=Number(row.start_time);
 if(!p||!row.id||!Number.isFinite(start)||start<=0)return null;
 const seconds=v=>Math.max(0,Math.min(2147483647,Math.floor(Number(v)||0)));
 const reason=String(row.end_call_reason||'');
 const status=Number(row.status)===1?'Answered':/BUSY/i.test(reason)?'Busy':/FAIL|ERROR|INVALID|REJECT/i.test(reason)?'Failed':Number(row.status)===2?'Unanswered':'Unknown';
 return {call_id:String(row.id),phone:p,stringeex_agent_id:row.account?String(row.account):null,agent_name:String(row.account_name||'Unmapped StringeeX agent'),started_at:new Date(start).toISOString(),ended_at:Number(row.end_time)>0?new Date(Number(row.end_time)).toISOString():null,status,duration_seconds:seconds(row.duration||((Number(row.end_time)-start)/1000)),talk_seconds:seconds(row.talk_duration??row.answer_duration),end_reason:reason||null,synced_at:new Date().toISOString()};
}

// One row per phone. Sourced arrival takes precedence over registration; date-only
// imports stay date-only and never produce an invented response time.
export function analytics(players,records,contacts,calls,links=[],agents=[],filters={}){
 const groups=new Map(),users=new Map(),missing=new Set();
 const validTime=v=>v&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
 const day=v=>new Date(v).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
 const group=p=>{p=phone(p);if(!p)return null;if(!groups.has(p))groups.set(p,{phone:p,usernames:[],sources:new Set(),arrivals:[],registrations:[],calls:[],notes:[]});return groups.get(p)};
 for(const p of players){users.set(String(p.username||'').toLowerCase(),p);const g=group(p.phone);if(!g){missing.add('user:'+p.username);continue}g.usernames.push(p.username);const t=validTime(p.registered_at);if(t!==null)g.registrations.push({at:new Date(t).toISOString(),date:day(t),precision:'exact',basis:'Registration time'})}
 for(const r of records){const player=users.get(String(r.username||'').toLowerCase()),g=group(player?.phone||r.phone);if(!g){missing.add(r.lead_key);continue}if(r.notes&&!g.notes.includes(String(r.notes)))g.notes.push(String(r.notes));if(!r.lead_date&&!r.lead_source&&player)continue;g.sources.add(r.lead_source||'Manual');
  if(String(r.lead_source||'').trim().toLowerCase()==='manual'){
   const uploaded=validTime(r.created_at),legacy=uploaded!==null&&uploaded<Date.parse('2026-10-24T00:00:00+05:30');
   const t=legacy?(validTime(r.arrival_override_at)??Date.parse('2026-10-19T14:00:00+05:30')):uploaded;
   if(t!==null)g.arrivals.push({at:new Date(t).toISOString(),date:day(t),precision:'exact',basis:legacy?'Manual lead arrival (configured baseline)':'Manual lead upload time'});
  }
  else if(r.lead_date&&/^\d{4}-\d{2}-\d{2}$/.test(r.lead_date))g.arrivals.push({at:null,date:r.lead_date,precision:'date',basis:'Imported lead date (time unavailable)'});
  else{const t=validTime(r.created_at);if(t!==null)g.arrivals.push({at:new Date(t).toISOString(),date:day(t),precision:'exact',basis:'Added to WinTurbo (upload time)'})}
 }
 for(const w of contacts){const g=group(w.phone);if(!g)continue;g.sources.add('WATI');const t=validTime(w.contact_created_at);if(t!==null)g.arrivals.push({at:new Date(t).toISOString(),date:day(t),precision:'exact',basis:'WATI contact created'});else{const seen=validTime(w.first_seen_at);if(seen!==null)g.arrivals.push({at:new Date(seen).toISOString(),date:day(seen),precision:'exact',basis:'First WATI sync (arrival unavailable)'})}}
 const names=new Map(agents.map(a=>[a.user_id,a.name])),mapped=new Map(links.map(l=>[l.stringeex_id,names.get(l.user_id)]));
 const callerOptions=new Map();
 for(const c of calls){if(!validTime(c.started_at))continue;const caller=mapped.get(c.stringeex_agent_id)||c.agent_name||'Unmapped StringeeX agent';if(c.stringeex_agent_id)callerOptions.set(c.stringeex_agent_id,caller);const g=groups.get(phone(c.phone));if(g)g.calls.push({...c,agent_name:caller})}
 let rows=[];
 for(const g of groups.values()){
  const sourceArrivals=g.sources.size?g.arrivals:g.registrations;
  sourceArrivals.sort((a,b)=>Date.parse(a.at||a.date+'T00:00:00+05:30')-Date.parse(b.at||b.date+'T00:00:00+05:30'));
  const arrival=sourceArrivals[0]||null;
  if(filters.from&&(!arrival||arrival.date<filters.from)||filters.to&&(!arrival||arrival.date>filters.to))continue;
  if(filters.source&&!(filters.source==='Registered only'?!g.sources.size:g.sources.has(filters.source)))continue;
  const selected=g.calls.filter(c=>!filters.agent||c.stringeex_agent_id===filters.agent).sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at));
  const boundary=arrival?Date.parse(arrival.at||arrival.date+'T00:00:00+05:30'):null;
  const after=boundary===null?selected:selected.filter(c=>Date.parse(c.started_at)>=boundary),first=after[0]||null;
  const measurable=arrival?.precision==='exact'&&!arrival.basis.includes('arrival unavailable');
  const delay=first&&measurable?Math.floor((Date.parse(first.started_at)-boundary)/1000):null;
  const row={phone:g.phone,usernames:g.usernames,notes:g.notes,sources:[...g.sources],arrival,first_call:first,last_call:selected.at(-1)||null,calls:selected,attempts:selected.length,attempts_after_arrival:after.length,calls_before_arrival:selected.length-after.length,delay_seconds:delay,state:first?'Called':selected.length?'Only calls before arrival':'No synced calls'};
  if(filters.state==='called'&&!selected.length||filters.state==='pending'&&first)continue;
  rows.push(row);
 }
 rows.sort((a,b)=>(b.arrival?.date||'').localeCompare(a.arrival?.date||'')||a.phone.localeCompare(b.phone));
 const delays=rows.map(r=>r.delay_seconds).filter(v=>v!==null).sort((a,b)=>a-b),sum=delays.reduce((a,b)=>a+b,0);
 return {rows,agents:[...callerOptions].map(([id,name])=>({id,name})),sources:[...new Set([...groups.values()].flatMap(g=>[...g.sources]))].sort(),stats:{numbers:rows.length,called:rows.filter(r=>r.attempts>0).length,awaiting_first:rows.filter(r=>!r.first_call).length,attempts:rows.reduce((n,r)=>n+r.attempts,0),measured:delays.length,average_seconds:delays.length?Math.round(sum/delays.length):null,median_seconds:delays.length?(delays.length%2?delays[(delays.length-1)/2]:Math.round((delays[delays.length/2-1]+delays[delays.length/2])/2)):null,within_5_min:delays.filter(v=>v<=300).length,within_15_min:delays.filter(v=>v<=900).length,date_only:rows.filter(r=>r.arrival?.precision==='date').length,missing_phone:missing.size},buckets:[{label:'0–5 minutes',count:delays.filter(v=>v<=300).length},{label:'5–15 minutes',count:delays.filter(v=>v>300&&v<=900).length},{label:'15–60 minutes',count:delays.filter(v=>v>900&&v<=3600).length},{label:'Over 1 hour',count:delays.filter(v=>v>3600).length}]};
}
