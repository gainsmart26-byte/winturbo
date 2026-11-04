(function(root){
 const registered=x=>x.registration==='Registered';
 const paid=x=>registered(x)&&Number(x.lifetime_deposits)>0;
 const status=x=>registered(x)?paid(x)?'paid':'unpaid':x.registration==='Review needed'?'review':'unregistered';
 const day=value=>{if(!value)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;if(!Number.isFinite(Date.parse(value)))return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))};
 const rowDate=(x,basis)=>day(basis==='paid'?x.ftd_at:x.registered_at||x.record?.lead_date||x.created_at);
 const sourceKeys=x=>[...(x.wati_connection_ids||[]).map(id=>'wati:'+id),'source:'+(x.record?.lead_source||x.source||'Unknown')];
 function filter(rows,f){return rows.filter(x=>{
  const date=rowDate(x,f.basis),s=status(x),search=String(f.search||'').toLowerCase();
  return (!f.segment||s===f.segment||(f.segment==='wati_unregistered'&&s==='unregistered'&&(x.wati_connection_ids||[]).length>0))&&(!f.source||sourceKeys(x).includes(f.source))&&(!f.from||date&&date>=f.from)&&(!f.to||date&&date<=f.to)&&(!search||[x.username,x.phone].some(v=>String(v||'').toLowerCase().includes(search)))&&(!f.response||(f.response==='new'?!x.record?.response:x.record?.response===f.response))&&(!f.due||x.record?.callback_at&&new Date(x.record.callback_at)<=new Date());
 })}
 function summary(rows){return {total:rows.length,registered:rows.filter(registered).length,paid:rows.filter(paid).length,unpaid:rows.filter(x=>status(x)==='unpaid').length,unregistered:rows.filter(x=>status(x)==='unregistered').length,wati_unregistered:rows.filter(x=>status(x)==='unregistered'&&(x.wati_connection_ids||[]).length).length,review:rows.filter(x=>status(x)==='review').length}}
 function groups(rows,keyFn){const groups=new Map();for(const row of rows)for(const key of new Set(keyFn(row))){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}return [...groups].map(([key,items])=>({key,...summary(items)}))}
 function dial(value){let n=String(value||'').replace(/[^0-9]/g,'');if(n.length===10)n='91'+n;return /^[1-9]\d{7,14}$/.test(n)?'tel:+'+n:null}
 const api={registered,paid,status,day,rowDate,sourceKeys,filter,summary,groups,dial};root.CallIntellCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
