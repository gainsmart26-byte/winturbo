// Only published, text-backed casino banners from WinTurbo's own public API.
export function casinoUpdates(payload,now){
  const banners=Array.isArray(payload?.data)?payload.data:[];
  return banners.flatMap(banner=>{
    const title=typeof banner.title==='string'?banner.title.trim():'';
    const body=typeof banner.body==='string'?banner.body.trim():'';
    if(!banner.id||(!title&&!body)||!/(\bcasino\b|\bslots?\b|\broulette\b|\bblackjack\b|\bbaccarat\b|\bpoker\b|\baviator\b)/i.test(title+' '+body))return [];
    if(banner.isActive===false)return [];
    const startValue=banner.startsAt||banner.startDate||null,endValue=banner.endsAt||banner.endDate||null;
    const start=startValue?new Date(startValue):now,end=endValue?new Date(endValue):null;
    if(Number.isNaN(start.getTime())||(end&&(Number.isNaN(end.getTime())||end<=now)))return [];
    return [{external_event_id:'casino-banner:'+String(banner.id),sport_id:null,sport_name:'Casino',tournament_id:null,tournament_name:'Published casino update',event_name:title||body.slice(0,160),home_name:null,away_name:null,starts_at:start.toISOString(),market_count:0,provider:'WinTurbo',source_url:'https://winturbo.com/',is_active:true,
      raw_data:{content_category:'casino',description:body,event_time_kind:startValue?'scheduled':'observed',ends_at:end?.toISOString()||null,evidence_url:'https://winturbo.com/api/public/banners'},last_seen_at:now.toISOString(),updated_at:now.toISOString()}];
  });
}
