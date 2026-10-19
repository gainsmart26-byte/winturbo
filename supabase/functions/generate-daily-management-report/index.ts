import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const cors={"content-type":"application/json"};
const money=(v:unknown)=>`INR ${Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2})}`;
const number=(v:unknown)=>Number(v||0).toLocaleString("en-IN");
const available=(v:unknown)=>v!==null&&v!==undefined&&v!=="";

async function createPdf(m:any){
  const pdf=await PDFDocument.create();
  pdf.setTitle(`WinTurbo Daily Reporting - ${m.report_date}`);
  pdf.setAuthor("WinTurbo Management Intelligence");
  pdf.setSubject("Daily executive performance report");
  const page=pdf.addPage([595.28,841.89]);
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy=rgb(0.025,0.055,0.12),navy2=rgb(0.055,0.095,0.18),orange=rgb(1,0.37,0.075),green=rgb(0.055,0.64,0.37),blue=rgb(0.13,0.42,0.92),red=rgb(0.87,0.22,0.24),paper=rgb(0.975,0.98,0.99),white=rgb(1,1,1),ink=rgb(0.07,0.09,0.14),muted=rgb(0.40,0.44,0.51),line=rgb(0.86,0.885,0.925),softBlue=rgb(0.92,0.95,1),softOrange=rgb(1,.95,.91),softGreen=rgb(.91,.98,.95);
  const reportDateLong=new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"2-digit",month:"long",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(`${m.report_date}T12:00:00+05:30`));
  const generatedAt=new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Kolkata"}).format(new Date()).replace(/[\u202f\u00a0]/g," ");
  const reportId=`WT-${String(m.report_date).replaceAll("-","")}`;
  const dailyReg=Number(m.daily_registered_users||0),dailyFtd=Number(m.daily_ftd_users||0),conversion=dailyReg?100*dailyFtd/dailyReg:0;
  const totalSpend=Number(m.total_advertising_spend||0),deposits=Number(m.daily_deposit_amount||0),withdrawals=Number(m.total_withdrawals||0);
  const netFlow=deposits-withdrawals-totalSpend;
  const drawText=(value:string,x:number,y:number,size:number,font=regular,color=ink)=>page.drawText(String(value),{x,y,size,font,color});
  const rule=(x:number,y:number,w:number,color=line)=>page.drawLine({start:{x,y},end:{x:x+w,y},thickness:1,color});
  const card=(x:number,y:number,w:number,h:number,label:string,value:string,detail:string,accent:any,tint:any)=>{
    page.drawRectangle({x:x+2,y:y-2,width:w,height:h,color:rgb(.90,.92,.95),opacity:.32});
    page.drawRectangle({x,y,width:w,height:h,color:white,borderColor:line,borderWidth:.8});
    page.drawRectangle({x,y,width:5,height:h,color:accent});
    page.drawCircle({x:x+w-18,y:y+h-17,size:6,color:tint});
    drawText(label,x+17,y+h-20,7,bold,muted);drawText(value,x+17,y+25,16,bold,ink);drawText(detail,x+17,y+10,7,regular,muted);
  };
  page.drawRectangle({x:0,y:0,width:595.28,height:841.89,color:paper});
  page.drawRectangle({x:0,y:682,width:595.28,height:160,color:navy});
  page.drawRectangle({x:0,y:682,width:595.28,height:7,color:orange});
  page.drawCircle({x:554,y:804,size:92,color:navy2});page.drawCircle({x:564,y:812,size:54,color:orange,opacity:.10});
  page.drawRectangle({x:38,y:777,width:30,height:30,color:orange});drawText("W",45,785,18,bold,white);
  drawText("WINTURBO",78,794,20,bold,white);drawText("MANAGEMENT INTELLIGENCE",78,780,7.5,bold,rgb(.66,.75,.88));
  drawText("Daily Performance Report",38,738,25,bold,white);drawText("A concise view of acquisition, deposits, withdrawals and media efficiency.",38,719,8.5,regular,rgb(.75,.81,.9));
  page.drawRectangle({x:377,y:705,width:180,height:57,color:navy2,borderColor:rgb(.19,.27,.4),borderWidth:1});
  drawText("REPORTING DATE",391,745,7,bold,rgb(.61,.70,.83));drawText(reportDateLong,391,728,10,bold,white);drawText(`${reportId}  |  IST`,391,713,7,regular,orange);
  drawText("EXECUTIVE SNAPSHOT",38,655,10.5,bold,navy);drawText("Key operating metrics for the reporting day",175,655,7.5,regular,muted);rule(38,646,519);
  const cards=[
    ["DAILY REGISTRATIONS",number(dailyReg),`Total registered: ${number(m.total_registered_users)}`,blue,softBlue],
    ["DAILY FTD",number(dailyFtd),`Total FTD: ${number(m.total_ftd_users)}`,orange,softOrange],
    ["AVERAGE FTD DEPOSIT",money(m.average_deposit_per_user),`${number(m.daily_depositors)} active depositors`,green,softGreen],
    ["ADVERTISING SPEND",money(totalSpend),"All connected paid channels",blue,softBlue],
    ["TOTAL WITHDRAWALS",money(withdrawals),"Approved, processing and paid",red,rgb(1,.93,.93)],
    ["COST PER FTD",money(m.cost_per_ftd),`Cost / registration: ${money(m.cost_per_registration)}`,orange,softOrange]
  ];
  cards.forEach((c:any[],i)=>{const col=i%3,row=Math.floor(i/3);card(38+col*176,562-row*79,163,63,c[0],c[1],c[2],c[3],c[4]);});
  page.drawRectangle({x:38,y:379,width:519,height:66,color:navy});
  const score=[
    ["FTD CONVERSION",`${conversion.toFixed(1)}%`,orange],
    ["DEPOSITS RECEIVED",money(deposits),green],
    ["NET CASH FLOW",money(netFlow),netFlow>=0?green:red],
    ["ACTIVE DEPOSITORS",number(m.daily_depositors),blue]
  ];
  score.forEach((r:any[],i)=>{const x=54+i*126;if(i)page.drawLine({start:{x:x-14,y:393},end:{x:x-14,y:431},thickness:.8,color:rgb(.22,.29,.4)});drawText(r[0],x,424,6.5,bold,rgb(.62,.71,.83));drawText(r[1],x,400,12,bold,r[2]);});
  drawText("ACQUISITION FUNNEL",38,351,10.5,bold,navy);drawText("Daily lead-to-FTD movement",164,351,7.5,regular,muted);rule(38,342,519);
  const stages=[
    ["Leads",available(m.daily_leads)?number(m.daily_leads):"Awaiting source",blue],
    ["Registrations",number(dailyReg),green],
    ["FTD",number(dailyFtd),orange]
  ];
  stages.forEach((r:any[],i)=>{const x=38+i*176,w=163;page.drawRectangle({x,y:285,width:w,height:43,color:white,borderColor:line,borderWidth:.8});page.drawRectangle({x,y:285,width:w,height:5,color:r[2]});drawText(r[0],x+12,310,7,bold,muted);drawText(r[1],x+12,292,12,bold,r[1]==="Awaiting source"?orange:ink);if(i<2){drawText("->",x+w+5,302,11,bold,muted);}});
  const leadReg=available(m.leads_to_registration_rate)?`${Number(m.leads_to_registration_rate).toFixed(1)}%`:"Awaiting source";
  const leadFtd=available(m.leads_to_ftd_rate)?`${Number(m.leads_to_ftd_rate).toFixed(1)}%`:"Awaiting source";
  drawText(`Lead -> registration: ${leadReg}`,46,267,7.5,regular,muted);drawText(`Lead -> FTD: ${leadFtd}`,228,267,7.5,regular,muted);drawText(`Registration -> FTD: ${conversion.toFixed(1)}%`,390,267,7.5,bold,orange);
  drawText("MEDIA INVESTMENT",38,237,10.5,bold,navy);drawText("Daily advertising spend by channel",149,237,7.5,regular,muted);rule(38,228,519);
  const spend=m.channel_spend||{},channels=[
    ["Facebook Ads",Number(spend.facebook_ads||0),blue],
    ["Google Ads",Number(spend.google_ads||0),green],
    ["Telegram Ads",Number(spend.telegram_ads||0),orange]
  ];
  const maxSpend=Math.max(1,...channels.map(x=>Number(x[1])));
  channels.forEach((r:any[],i)=>{const y=197-i*29;drawText(r[0],44,y+4,8,regular,muted);page.drawRectangle({x:139,y,width:280,height:10,color:rgb(.91,.93,.96)});page.drawRectangle({x:139,y,width:280*Number(r[1])/maxSpend,height:10,color:r[2]});drawText(money(r[1]),439,y+2,8,bold,ink);});
  page.drawRectangle({x:38,y:76,width:519,height:54,color:white,borderColor:line,borderWidth:.8});
  drawText("MANAGEMENT NOTE",52,111,7,bold,navy);drawText(available(m.daily_leads)?"All connected reporting sources were included in this edition.":"Lead metrics are pending the connected lead-source feed and will populate automatically.",52,94,8,bold,available(m.daily_leads)?green:orange);
  drawText("Financial values reflect the latest synchronized Admin Intelligence and expense records.",52,81,7,regular,muted);
  rule(38,51,519);drawText(`Generated ${generatedAt} IST  |  ${reportId}`,38,34,7,regular,muted);drawText("CONFIDENTIAL - INTERNAL MANAGEMENT USE",353,34,7,bold,navy);
  return pdf.save();
}

Deno.serve(async(req)=>{
  try{
    if(req.method!=="POST")return new Response(JSON.stringify({error:"POST required"}),{status:405,headers:cors});
    const expected=Deno.env.get("DAILY_REPORT_CRON_SECRET");
    if(expected&&req.headers.get("x-cron-secret")!==expected)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:cors});
    const body=await req.json().catch(()=>({}));
    const now=new Date(),formatter=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}),today=formatter.format(now);
    const defaultDate=new Date(`${today}T00:00:00+05:30`);defaultDate.setDate(defaultDate.getDate()-1);
    const reportDate=body.report_date||formatter.format(defaultDate);
    const recipient=String(body.recipient||Deno.env.get("DAILY_REPORT_WHATSAPP")||"918383845929").replace(/\D/g,"");
    const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:metrics,error:metricError}=await sb.rpc("daily_management_report_metrics",{p_report_date:reportDate});if(metricError)throw metricError;
    const bytes=await createPdf(metrics),path=`${reportDate}/winturbo-daily-reporting-${reportDate}.pdf`;
    const {error:uploadError}=await sb.storage.from("daily-management-reports").upload(path,bytes,{contentType:"application/pdf",upsert:true});if(uploadError)throw uploadError;
    const {data:publicData}=sb.storage.from("daily-management-reports").getPublicUrl(path),pdfUrl=publicData.publicUrl;
    await sb.from("daily_management_reports").upsert({report_date:reportDate,recipient,metrics,pdf_path:path,pdf_url:pdfUrl,delivery_status:"generated",generated_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    const endpoint=Deno.env.get("WATI_API_ENDPOINT"),token=Deno.env.get("WATI_API_TOKEN");
    if(!endpoint||!token){await sb.from("daily_management_reports").update({delivery_status:"failed",error_message:"WATI_API_ENDPOINT or WATI_API_TOKEN is not configured",updated_at:new Date().toISOString()}).eq("report_date",reportDate);return new Response(JSON.stringify({ok:true,generated:true,sent:false,report_date:reportDate,pdf_url:pdfUrl,setup_required:["WATI_API_ENDPOINT","WATI_API_TOKEN"]}),{status:200,headers:cors});}
    const url=`${endpoint.replace(/\/$/,"")}/api/v1/sendSessionFileViaUrl/${recipient}?fileUrl=${encodeURIComponent(pdfUrl)}&caption=${encodeURIComponent(`WinTurbo Daily Reporting - ${reportDate}`)}`;
    const send=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${token}`,accept:"application/json"}}),raw=await send.text();if(!send.ok)throw new Error(`WATI ${send.status}: ${raw.slice(0,500)}`);
    let response:any={};try{response=JSON.parse(raw)}catch{response={raw}}
    await sb.from("daily_management_reports").update({delivery_status:"accepted",provider_message_id:response?.id||response?.localMessageId||null,sent_at:new Date().toISOString(),error_message:null,updated_at:new Date().toISOString()}).eq("report_date",reportDate);
    return new Response(JSON.stringify({ok:true,generated:true,sent:true,report_date:reportDate,pdf_url:pdfUrl,provider_response:response}),{headers:cors});
  }catch(error){return new Response(JSON.stringify({ok:false,error:error instanceof Error?error.message:String(error)}),{status:500,headers:cors});}
});
