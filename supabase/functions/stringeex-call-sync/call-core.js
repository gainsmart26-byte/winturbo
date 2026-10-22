export function phone(value){
 let s=String(value??'').trim().replace(/[\s()+.\-]/g,'');
 if(s.startsWith('00'))s=s.slice(2);
 if(/^91\d{10}$/.test(s))s=s.slice(2);
 return /^\d{7,15}$/.test(s)?s:'';
}
export function normalize(row){
 if(Number(row.direction)!==0)return null;
 const p=phone(row.customer_number),start=Number(row.start_time);
 if(!p||!row.id||!Number.isFinite(start)||start<=0)return null;
 const seconds=v=>Math.max(0,Math.min(2147483647,Math.floor(Number(v)||0)));
 const reason=String(row.end_call_reason||'');
 const status=Number(row.status)===1?'Answered':/BUSY/i.test(reason)?'Busy':/FAIL|ERROR|INVALID|REJECT/i.test(reason)?'Failed':Number(row.status)===2?'Unanswered':'Unknown';
 return {call_id:String(row.id),phone:p,stringeex_agent_id:row.account?String(row.account):null,agent_name:String(row.account_name||'Unmapped StringeeX agent'),started_at:new Date(start).toISOString(),ended_at:Number(row.end_time)>0?new Date(Number(row.end_time)).toISOString():null,status,duration_seconds:seconds(row.duration||((Number(row.end_time)-start)/1000)),talk_seconds:seconds(row.talk_duration??row.answer_duration),end_reason:reason||null,synced_at:new Date().toISOString()};
}
