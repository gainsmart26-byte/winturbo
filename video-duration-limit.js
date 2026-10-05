/* WINTURBO_VIDEO_DURATION_LIMIT_V1 */
(()=>{
  const VIDEO_FUNCTIONS=new Set(['generate-fal-video','generate-higgsfield-video']);

  function lockDurationControls(root=document){
    const direct=root.querySelector?.('#ideaVideoDuration');
    if(direct){
      direct.value='10';
      direct.min='10';
      direct.max='10';
      direct.step='1';
      direct.readOnly=true;
      direct.setAttribute('aria-readonly','true');
    }

    root.querySelectorAll?.('input,select').forEach(control=>{
      const context=`${control.id||''} ${control.name||''} ${control.getAttribute('aria-label')||''}`.toLowerCase();
      if(!context.includes('duration')||context.includes('audio'))return;
      if(control.tagName==='SELECT'){
        [...control.options].forEach(option=>{if(Number(option.value)!==10)option.remove()});
        if(![...control.options].some(option=>Number(option.value)===10))control.add(new Option('10 seconds','10'));
      }
      control.value='10';
      if(control.tagName==='INPUT'){
        control.min='10';
        control.max='10';
        control.readOnly=true;
      }
      control.dataset.videoDurationLocked='true';
    });

    const wrap=root.querySelector?.('#ideaVideoDurationWrap');
    if(wrap){
      const note=wrap.querySelector('.subv');
      if(note)note.textContent='Fixed at 10 seconds for every generated video.';
    }
  }

  function installInvokeGuard(){
    if(!window.sb?.functions?.invoke||window.sb.functions.__tenSecondGuard)return false;
    const original=window.sb.functions.invoke.bind(window.sb.functions);
    const guarded=async(name,options={})=>{
      if(VIDEO_FUNCTIONS.has(name)){
        options={...options,body:{...(options.body||{}),duration:10}};
      }
      return original(name,options);
    };
    guarded.__tenSecondGuard=true;
    window.sb.functions.invoke=guarded;
    window.sb.functions.__tenSecondGuard=true;
    return true;
  }

  function initialize(){
    lockDurationControls();
    if(!installInvokeGuard())setTimeout(initialize,250);
  }

  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
    if(node.nodeType===1)lockDurationControls(node);
  }))).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('input',event=>{
    if(event.target?.dataset?.videoDurationLocked==='true')event.target.value='10';
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
