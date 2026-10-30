/* Shared deadline for password login. Authorization is checked by the existing panel. */
(function(){
  window.WinTurboLoginDeadline=async function(request){
    let timer;
    try{return await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Access verification timed out. Please reload and retry.')),20000)})])}
    finally{clearTimeout(timer)}
  };
  window.WinTurboPasswordLogin=async function(credentials){
    let timer;
    try{
      return await Promise.race([
        sb.auth.signInWithPassword(credentials),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Sign-in timed out. The authentication service did not respond. Reload the page before trying again.')),20000)})
      ]);
    }finally{clearTimeout(timer)}
  };
})();
