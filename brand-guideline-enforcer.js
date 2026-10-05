/* WINTURBO_BRAND_GUIDELINE_ENFORCER_V1 */
(()=>{
  const WINTURBO_ACCOUNT_ID='f64f559e-1365-4cdd-acc9-2ba1a5748da8';
  const TEXT_RULES=`WIN TURBO BRAND RULES (highest priority): Write for WinTurbo as an adult sports-betting, gambling and casino education brand—not generic gaming, esports, consoles or gamer culture. Default to natural Roman-script Hinglish. Focus on verified sports/events, betting education, casino mechanics, approved product/support updates, responsible play, or an explicitly supplied active approved offer. Never invent odds, results, offers, claims, testimonials, winnings or payment evidence. Never promise profit, fixed signals or guaranteed outcomes. Keep WinTurbo separate from Jaani Player and The Great Raka. Include suitable 18+ / financial-risk / play-responsibly wording. Human approval is required.`;
  const IMAGE_RULES=`WIN TURBO VISUAL RULES: Adult sports-betting and casino editorial creative only—not generic gaming, esports, controllers, consoles or children's imagery. Premium charcoal, white, electric-green and orange direction; high contrast and readable mobile typography. Use only the approved WinTurbo identity. Never fabricate winnings, receipts, odds, screens, endorsements, testimonials or offers. Include responsible-play wording where relevant.`;
  const VIDEO_RULES=`WIN TURBO VIDEO RULES: Exactly 10 seconds maximum, vertical 9:16 by default. Immediate hook, one adult sports-betting/casino/verified-event idea, clear closing frame and approximately 18–24 spoken words. No generic gaming or esports. No guaranteed wins, fixed signals, loss chasing, fabricated facts or unapproved offers. Show adult-audience, financial-risk and responsible-play wording.`;
  const profileCache=new Map();

  function selectedAccountId(body={}){
    const supplied=body?.brand?.publishing_account_id||body?.publishing_account_id||body?.brand_profile?.publishing_account_id;
    if(supplied)return String(supplied);
    for(const id of ['ideaPublishingAccountV49','smBrand59','manualChannelV74']){
      const value=document.getElementById(id)?.value;
      if(value)return value;
    }
    const rec=JSON.stringify(body?.recommendation||{}).toLowerCase();
    if(rec.includes('winturbo')||rec.includes('company/brand channel'))return WINTURBO_ACCOUNT_ID;
    return '';
  }

  async function profile(accountId){
    if(!accountId||!window.sb?.from)return null;
    if(profileCache.has(accountId))return profileCache.get(accountId);
    const result=await window.sb.from('publishing_brand_profiles').select('publishing_account_id,brand_name,brand_description,audience,primary_language,tone_of_voice,visual_style,text_generation_instructions,image_generation_instructions,video_generation_instructions,forbidden_brands,forbidden_terms').eq('publishing_account_id',accountId).eq('is_active',true).maybeSingle();
    const value=result.error?null:result.data;
    profileCache.set(accountId,value);
    return value;
  }

  function addRule(value,rule){return `${rule}\n\nREQUESTED DIRECTION:\n${String(value||'').trim()}`.trim()}

  function install(){
    if(!window.sb?.functions?.invoke||window.sb.functions.__brandGuidelineEnforcer)return false;
    const original=window.sb.functions.invoke.bind(window.sb.functions);
    const guarded=async(name,options={})=>{
      if(!['generate-social-post','generate-openai-image','generate-higgsfield-image','generate-higgsfield-video','generate-fal-video'].includes(name))return original(name,options);
      const body={...(options.body||{})},accountId=selectedAccountId(body);
      if(accountId!==WINTURBO_ACCOUNT_ID)return original(name,options);
      const stored=await profile(accountId);
      if(name==='generate-social-post'){
        const recommendation={...(body.recommendation||{})};
        recommendation.theme=addRule(recommendation.theme,TEXT_RULES);
        recommendation.hook_direction=addRule(recommendation.hook_direction,TEXT_RULES);
        recommendation.cta_direction=addRule(recommendation.cta_direction,TEXT_RULES);
        body.recommendation=recommendation;
        body.publishing_account_id=accountId;
        body.brand={...(body.brand||{}),publishing_account_id:accountId,account_name:'WinTurbo'};
        if(stored)body.brand_profile=stored;
      }else{
        const rules=name.includes('video')?VIDEO_RULES:IMAGE_RULES;
        body.prompt=addRule(body.prompt,rules);
        if(name.includes('video'))body.duration=10;
      }
      return original(name,{...options,body});
    };
    guarded.__brandGuidelineEnforcer=true;
    window.sb.functions.invoke=guarded;
    window.sb.functions.__brandGuidelineEnforcer=true;
    return true;
  }

  function boot(){if(!install())setTimeout(boot,250)}
  boot();
})();
