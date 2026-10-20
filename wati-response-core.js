/* Pure analytics over complete WATI conversation history. No message bodies retained. */
(function(root){
 function time(m){const v=m.created;if(typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&/(Z|[+-]\d\d:\d\d)$/.test(v)){const n=Date.parse(v);if(Number.isFinite(n))return n}const n=Number(m.timestamp);return Number.isFinite(n)&&n>0?(n<1e12?n*1000:n):null}
 function summarize(messages,now=Date.now()){
  const unique=new Map();let invalid=0;
  for(const m of messages){if(['system','event','notification','reaction'].includes(String(m.type).toLowerCase()))continue;if(/failed/i.test(m.statusString||''))continue;const at=time(m);if(!m.id||at===null||at>now||typeof m.owner!=='boolean'){invalid++;continue}unique.set(m.id,{...m,at})}
  const sorted=[...unique.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));let pending=null,first=null,reply=null,automatic=null;const delays=[];
  for(const m of sorted){if(!m.owner){if(first===null)first=m.at;if(pending===null)pending=m.at}else if(pending!==null){const automated=m.isAutomated===true||m.isFromBot===true||/chatbot|template/i.test(m.eventType||'')||m.type==='template';if(automated){if(automatic===null)automatic=m.at;continue}if(reply===null)reply=m.at;delays.push(m.at-pending);pending=null}}
  // Missing timestamps/direction can hide the true first reply. Do not publish misleading KPIs.
  if(invalid)return {invalid,status:'Incomplete message data',first:null,reply:null,firstDelay:null,average:null,pending:null,wait:null,count:0,automatic:null};
  return {invalid:0,status:first===null?'No incoming message':reply===null?'Unanswered':'Replied',first,reply,firstDelay:reply===null||first===null?null:reply-first,average:delays.length?delays.reduce((a,b)=>a+b,0)/delays.length:null,pending,wait:pending===null?null:Math.max(0,now-pending),count:delays.length,automatic};
 }
 function aggregate(rows){const values=rows.filter(r=>r.firstDelay!==null&&Number.isFinite(r.firstDelay)).map(r=>r.firstDelay).sort((a,b)=>a-b);return {measured:rows.filter(r=>r.first!==null).length,replied:values.length,unanswered:rows.filter(r=>r.first!==null&&r.reply===null).length,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,median:values.length?(values[Math.floor((values.length-1)/2)]+values[Math.floor(values.length/2)])/2:null,pending:rows.filter(r=>r.pending!==null).length}}
 const api={time,summarize,aggregate};root.WatiResponseCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
