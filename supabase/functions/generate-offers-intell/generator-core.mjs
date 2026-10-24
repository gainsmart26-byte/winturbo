export const TYPES=['Welcome Bonus','First Deposit Bonus','Reload Bonus','No Deposit Bonus'];
export const VERTICALS=['Sports','Casino Slots','Casino Live','Casino Table','Casino Baccarat','Casino Roulette','Fantasy','Racing','All'];
const number=(v,name,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`Invalid ${name}: use ${min}–${max}.`);return v;};
const text=(v,name,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`Invalid ${name}.`);return v.trim();};
const date=(v)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('Choose a valid offer date.');return v;};
const fmt=n=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(n);
export function validateRequest(b){
 const brief=text(b?.brief,'explanation',5000);if(brief.length<20)throw Error('Explain the offer in at least 20 characters.');
 const a=b.assumptions||{},p={};
 for(const [k,min,max] of [['deposit',1,1e8],['cap',1,1e7],['hold',0,100],['completion',0,100],['redemption',0,100],['fees',0,100],['other',0,1e7],['customers',1,1e6],['budget',1,1e10]])p[k]=number(a[k],k,min,max);
 if(!Number.isInteger(p.customers))throw Error('Customer count must be a whole number.');
 const type=b.type||'Auto';if(type!=='Auto'&&!TYPES.includes(type))throw Error('This offer type has not been verified for automatic generation.');
 if(!VERTICALS.includes(b.vertical))throw Error('Select a supported vertical.');
 const start=date(b.start),end=date(b.end);if(end<start)throw Error('End date must follow start date.');
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});if(end<today)throw Error('Offer end date is in the past.');
 return{brief,assumptions:p,type,vertical:b.vertical,audience:text(b.audience,'audience',160),start,end};
}
export function offerSchema(type='Auto'){
 const kinds=type==='Auto'?TYPES:[type];
 const variants=kinds.map(kind=>{const flat=kind==='No Deposit Bonus';return{type:'object',additionalProperties:false,properties:{title:{type:'string'},type:{type:'string',enum:[kind]},percent:flat?{type:'number',enum:[0]}:{type:'number'},cap:flat?{type:'number',enum:[0]}:{type:'number'},amount:flat?{type:'number'}:{type:'number',enum:[0]},multiplier:{type:'number'},basis:{type:'string',enum:flat?['bonus']:['deposit','bonus']},days:{type:'integer'},rationale:{type:'string'}},required:['title','type','percent','cap','amount','multiplier','basis','days','rationale']};});
 return{type:'object',additionalProperties:false,properties:{offers:{type:'array',items:{anyOf:variants}}},required:['offers']};
}
export const schema=offerSchema();
export function finalize(raw,input){
 if(!Array.isArray(raw?.offers)||raw.offers.length!==3)throw Error('Generator must return three offer drafts. Try again.');
 return raw.offers.map(o=>{
  if(!TYPES.includes(o.type)||(input.type!=='Auto'&&o.type!==input.type))throw Error('Generated offer used an unsupported type. Try again.');
  const title=text(o.title,'offer title',160),rationale=text(o.rationale,'rationale',1200);
  // Rationale is internal analysis; warnings such as "no guaranteed profit" are valid.
  // Player-facing terms and economics are generated deterministically below.
  const titleClaims=title.replace(/\b(?:no|not|without)\s+(?:any\s+)?guaranteed\s+(?:profits?|wins?|winnings|returns?)\b/gi,'');
  if(/guaranteed (profit|win|return)|risk.free|always win|recover.*loss/i.test(titleClaims))throw Error('Generated title contains an unsupported winnings promise.');
  const flat=o.type==='No Deposit Bonus';const percent=number(o.percent,'match percentage',0,1000),cap=number(o.cap,'bonus cap',0,input.assumptions.cap),amount=number(o.amount,'bonus amount',0,input.assumptions.cap);
  const multiplier=number(o.multiplier,'wagering multiplier',1,200),days=number(o.days,'wagering days',1,365);if(!Number.isInteger(days))throw Error('Invalid wagering days.');
  if(!['deposit','bonus'].includes(o.basis)||flat&&o.basis!=='bonus')throw Error('Invalid wagering basis.');
  if(flat?(amount<=0||percent!==0||cap!==0):(percent<=0||cap<=0||amount!==0))throw Error('Generated amount fields do not match the bonus type.');
  const p=input.assumptions,bonus=flat?amount:Math.min(p.deposit*percent/100,cap),deposit=flat?0:p.deposit,required=(flat||o.basis==='bonus'?bonus:deposit)*multiplier;
  const turnover=required*p.completion/100,gross=turnover*p.hold/100,cost=bonus*p.redemption/100+deposit*p.fees/100+p.other,net=gross-cost,campaignGrant=(flat?amount:cap)*p.customers;
  const headline=flat?`${fmt(amount)} bonus points, no deposit required`:`${fmt(percent)}% match bonus up to ${fmt(cap)} points`;
  const terms=[
   `DRAFT TERMS — requires admin review before publication.`,
   `Offer: ${headline}. Bonus type: ${o.type}.`,
   `Eligibility: ${input.audience}. Adults 18+ only, in jurisdictions where this offer is permitted. Excluded or self-excluded customers are not eligible. Confirm the audience segment before activation.`,
   `Offer availability: ${input.start} 00:00:00 to ${input.end} 23:59:59 IST. Configure these dates in the admin panel.`,
   `Eligible vertical: ${input.vertical}. ${input.vertical==='Sports'?'Sports market types and any minimum-odds gates must be confirmed in the admin panel. Fancy bets are exempt from the minimum-odds wagering gate according to the inspected panel.':'Confirm eligible games and their wagering contribution before publication.'}`,
   flat?`Fixed bonus grant: ${fmt(amount)} points. No deposit is required to receive this grant. Trigger and repeat-claim eligibility must be verified in the admin panel.`:`Bonus grant = the lower of ${fmt(percent)}% of the qualifying deposit and ${fmt(cap)} points. Example: a ${fmt(deposit)}-point deposit grants ${fmt(bonus)} bonus points. This example deposit is not a verified minimum-deposit rule. ${o.type==='First Deposit Bonus'?'Applies to an eligible first deposit. Confirm first-deposit eligibility in the admin panel.':'Confirm the deposit trigger and repeat-claim eligibility in the admin panel.'}`,
   `Wagering: ${fmt(multiplier)}× ${flat?'bonus granted':o.basis==='bonus'?'bonus granted':'qualifying deposit'}, to be completed within ${days} days of the grant. Required wagering for the example above: ${fmt(required)} points. Wagering completion does not guarantee profit or withdrawable funds.`,
   `Before publication, confirm bonus expiry consequences, bonus-to-cash conversion, withdrawal eligibility, cancellation, excluded bets and any claim limits. These behaviours were not verified; this draft does not introduce a winnings or withdrawal cap.`,
   `No winnings or returns are guaranteed. Play responsibly; do not chase losses.`,
  ].join('\n\n');
  return{title,type:o.type,headline,rationale,parameters:{percent,cap,amount,multiplier,basis:o.basis,days,vertical:input.vertical,audience:input.audience,start:input.start,end:input.end},terms,
   economics:{bonus,required,turnover,gross,cost,net,break_even_turnover:p.hold?cost/(p.hold/100):null,campaign_grant:campaignGrant,budget:p.budget,within_budget:campaignGrant<=p.budget},
   review_status:net>0&&campaignGrant<=p.budget?'Positive model — admin review required':'Rework — negative contribution or over budget',
   setup:flat?`Amount=${amount}; Wagering Multiplier=${multiplier}; Wagering Days=${days}.`:`Match Percent=${percent}; Cap=${cap}; Wagering Multiplier=${multiplier}; Wager Bonus Amount=${o.basis==='bonus'?'Yes':'No'}; Wagering Days=${days}.`};
 });
}
