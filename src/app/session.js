/** Editor identity and activity transport. Draft and dialog policy is injected. */
function createSession({client,offline,editorEmail,activityKey,channelName,sessionMs,warningMs,
  onChange,onInvalidate,onWarning,onExpire,onExternalSignOut,canTrackActivity,onSharedActivity,onClearTimers}) {
  let editorSession=null, signingOut=false, warningTimer=null, logoutTimer=null;
  let lastActivityBroadcast=0, channel=null, authSubscription=null, initialized=false;
  const listeners=[];

  function editorEmailMatches(email){return String(email||'').trim().toLowerCase()===String(editorEmail||'').trim().toLowerCase();}
  function clearSessionTimers(){clearTimeout(warningTimer);clearTimeout(logoutTimer);onClearTimers();}
  function scheduleSessionTimers(at){
    if(offline)return;
    clearSessionTimers();const elapsed=Math.max(0,Date.now()-at);
    warningTimer=setTimeout(onWarning,Math.max(0,warningMs-elapsed));
    logoutTimer=setTimeout(()=>onExpire('30분 동안 활동이 없어 자동 로그아웃되었습니다.'),Math.max(0,sessionMs-elapsed));
  }
  function setEditorSession(session){
    editorSession=editorEmailMatches(session?.user?.email)?session:null;
    onChange(editorSession);if(!editorSession)clearSessionTimers();return editorSession;
  }
  function acceptSharedActivity(at){
    if(!editorSession||!Number.isFinite(at)||Date.now()-at>=sessionMs)return;
    onSharedActivity();scheduleSessionTimers(at);
  }
  function resetInactivityTimer(){
    if(offline||!editorSession)return;
    const now=Date.now();try{localStorage.setItem(activityKey,String(now));}catch(error){console.warn(error);}
    scheduleSessionTimers(now);
    if(now-lastActivityBroadcast>1000){channel?.postMessage({type:'activity',at:now});lastActivityBroadcast=now;}
  }
  async function getEditorSession(){
    if(offline){setEditorSession({offline:true,user:{email:editorEmail}});return editorSession;}
    if(!client)return null;
    const {data:{session}}=await client.auth.getSession();setEditorSession(session);
    if(!editorSession){try{localStorage.removeItem(activityKey);}catch(_){}return null;}
    let stored=0;try{stored=Number(localStorage.getItem(activityKey)||0);}catch(_){}
    if(stored&&Date.now()-stored>=sessionMs){await onExpire('편집 세션이 만료되어 로그아웃했습니다.');return null;}
    const at=stored||Date.now();try{localStorage.setItem(activityKey,String(at));}catch(_){}
    scheduleSessionTimers(at);return editorSession;
  }
  async function signOutEditor({broadcast=true}={}){
    if(offline)return;
    clearSessionTimers();signingOut=true;
    // Notify consumers before awaiting a possibly failing server sign-out.
    onInvalidate();
    try{localStorage.removeItem(activityKey);}catch(_){}
    if(broadcast)channel?.postMessage({type:'signout'});
    try{if(client)await client.auth.signOut({scope:'local'});}
    catch(error){console.warn('서버 로그아웃 요청에 실패했지만 이 브라우저 세션은 종료합니다.',error);}
    finally{setEditorSession(null);signingOut=false;}
  }
  function listen(target,type,handler,options){target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));}
  function initialize(){
    if(initialized)return;initialized=true;
    channel=!offline&&'BroadcastChannel' in window?new BroadcastChannel(channelName):null;
    for(const type of ['pointerdown','keydown'])listen(document,type,()=>{if(editorSession&&canTrackActivity())resetInactivityTimer();},{passive:true});
    if(channel)listen(channel,'message',event=>{
      if(event.data?.type==='activity')acceptSharedActivity(Number(event.data.at));
      if(event.data?.type==='signout'&&editorSession&&!signingOut)void onExternalSignOut();
    });
    listen(window,'storage',event=>{
      if(event.key!==activityKey)return;
      if(event.newValue)acceptSharedActivity(Number(event.newValue));
      else if(editorSession&&!signingOut)void onExternalSignOut();
    });
    if(client)authSubscription=client.auth.onAuthStateChange((_event,session)=>{
      const wasAuthenticated=Boolean(editorSession),valid=editorEmailMatches(session?.user?.email)?session:null;
      if(valid){setEditorSession(valid);return;}
      setEditorSession(null);
      if(wasAuthenticated&&!signingOut)setTimeout(()=>void onExternalSignOut('편집 세션이 종료되었습니다.'),0);
    })?.data?.subscription;
  }
  function dispose(){clearSessionTimers();listeners.splice(0).forEach(remove=>remove());authSubscription?.unsubscribe();channel?.close();initialized=false;}
  return Object.freeze({editorEmailMatches,clearSessionTimers,scheduleSessionTimers,setEditorSession,acceptSharedActivity,resetInactivityTimer,getEditorSession,signOutEditor,initialize,dispose,current:()=>editorSession,isSigningOut:()=>signingOut});
}
