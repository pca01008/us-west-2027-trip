(()=>{
 const $=id=>document.getElementById(id),manifestNode=$('comparisonManifest');
 if(!manifestNode){$('status').textContent='비교 생성 후 ui-preview/daylight-compare.html을 열어 주세요.';return;}
 const manifest=JSON.parse(manifestNode.textContent),frames=[$('before'),$('after')];
 const sessionKey='daylight-compare-session:'+manifest.fixtureHash+':'+manifest.afterHash;
 let session;try{session=sessionStorage.getItem(sessionKey);}catch(_){}
 if(!session)session=crypto.randomUUID();
 const saveSession=()=>{try{sessionStorage.setItem(sessionKey,session);}catch(_){}};saveSession();
 const ready=new Set();let generation=0;
 $('beforeCommit').textContent=manifest.baseline.slice(0,7);$('afterCommit').textContent=manifest.candidate.slice(0,7);
 $('versionInfo').textContent=`기존 ${manifest.baseline.slice(0,7)} / 소스 ${manifest.beforeHash} · Daylight ${manifest.candidate.slice(0,7)} / 소스 ${manifest.afterHash} · 공통 예시 ${manifest.fixture} (${manifest.fixtureHash})`;
 function apply(frame){
  const doc=frame.contentDocument,win=frame.contentWindow;if(!doc||!ready.has(frame))return;
  const theme=doc.getElementById('themeSelect');theme.value=$('theme').value;theme.dispatchEvent(new win.Event('change',{bubbles:true}));
  const radio=doc.getElementById($('section').value);if(radio&&!radio.checked)radio.click();
  if(/^d\d+$/.test($('section').value))doc.getElementById($('schedule').value==='timetable'?'timetableViewBtn':'listViewBtn')?.click();
  win.scrollTo({top:0,behavior:'instant'});
  win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>win.scrollTo({top:0,behavior:'instant'})));
 }
 function status(){const done=ready.size===2;$('status').textContent=done?'같은 예시와 설정으로 비교할 준비가 됐습니다.':'두 버전을 불러오고 있습니다.';delete $('status').dataset.error;$('align').disabled=!done;}
 function size(){const width=Number($('viewport').value),height=width===390?844:width===768?1024:900;$('comparison').style.setProperty('--frame-width',width+'px');$('comparison').style.setProperty('--frame-height',height+'px');frames.forEach(frame=>frame.closest('section').hidden=$('layout').value!=='both'&&$('layout').value!==frame.id);}
 function load(){
  generation++;const current=generation;ready.clear();status();
  frames.forEach(frame=>{
   const url=new URL(`daylight-${frame.id}.html`,location.href);url.searchParams.set('session',session);url.searchParams.set('previewDate',$('moment').value);
   frame.onload=()=>{
    if(current!==generation)return;
    try{
     const doc=frame.contentDocument;if(!doc?.querySelector('meta[name="comparison-source"]'))throw new Error('missing comparison');
     const finish=()=>{if(doc.body.classList.contains('hydrating'))return false;ready.add(frame);apply(frame);status();return true;};
     if(!finish()){const observer=new MutationObserver(()=>{if(finish())observer.disconnect();});observer.observe(doc.body,{attributes:true,attributeFilter:['class']});}
    }catch(_){$('status').textContent='비교 화면을 열지 못했습니다. 공개 HTTPS 주소 또는 로컬 서버에서 다시 열어 주세요.';$('status').dataset.error='true';}
   };
   frame.src=url.href;$(frame.id+'Link').href=url.href;
  });
 }
 $('controls').addEventListener('submit',event=>event.preventDefault());
 ['viewport','layout'].forEach(id=>$(id).addEventListener('change',size));
 ['section','theme','schedule'].forEach(id=>$(id).addEventListener('change',()=>frames.forEach(apply)));
 $('moment').addEventListener('change',load);$('align').onclick=()=>frames.forEach(apply);
 $('reset').onclick=()=>{session=crypto.randomUUID();saveSession();load();};
 size();load();
})();
