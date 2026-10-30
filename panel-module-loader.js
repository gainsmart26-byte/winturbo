/* Retry module initialization after transient access/network failures. */
(function(){
  const modules=new Map();
  let profileRequest=null;
  window.WinTurboLoadProfile=function(){
    if(profileRequest)return profileRequest;
    const request=(async()=>{
      const auth=await sb.auth.getUser();if(auth.error)throw auth.error;
      const user=auth.data?.user;if(!user)return {user:null,profile:null};
      const result=await sb.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle();
      if(result.error)throw result.error;
      return {user,profile:result.data};
    })();
    let timeout;
    profileRequest=Promise.race([request,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Role check timed out')),10000)})]).finally(()=>{clearTimeout(timeout);profileRequest=null});
    return profileRequest;
  };
  window.WinTurboRegisterModule=function(id,boot){
    if(modules.has(id))return;
    let running=false,attempts=0,timer;
    async function run(reset=false){
      if(reset)attempts=0;
      clearTimeout(timer);
      if(running||document.getElementById(id))return;
      running=true;attempts++;
      try{await boot()}catch(error){console.warn('Could not initialize '+id+': '+(error.message||'network error'))}
      finally{
        running=false;
        if(!document.getElementById(id)&&attempts<5)timer=setTimeout(()=>run(),Math.min(3000*attempts,12000));
      }
    }
    modules.set(id,()=>run(true));
    setTimeout(()=>run(),0);
  };
  const retry=()=>modules.forEach(run=>run());
  document.addEventListener('winturbo-access-ready',retry);
  window.addEventListener('online',retry);
  document.addEventListener('click',e=>{if(e.target.closest?.('#refresh'))retry()});
})();
