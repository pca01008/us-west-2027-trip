function createExportsController({$,$$,CONFIG,EXPORT_BASE_NAME,blobToDataUrl,captureState,currentOperationSignal,fetchAsDataUrl,isOperationBusy,isOperationCancelled,normalizeState,setOperationBusy,setStatus,showChoice,showDialog,todayLocal}) {
  function stripTransient(root){root.querySelectorAll('#draftStorageWarning,.schedule-media-tools,.photo-actions,.row-actions,.photo-delete,.schedule-map-delete,.row-delete,.check-delete,.check-actions,.check-feedback,.warning-delete').forEach(el=>el.remove());root.querySelectorAll('[contenteditable]').forEach(el=>el.setAttribute('contenteditable','false'));}

  async function embedPhotos(state,{strict=true}={}){
    const normalized=normalizeState(state),template=document.createElement('template');template.innerHTML=normalized.html;const failures=[],photos=Array.from(template.content.querySelectorAll('.schedule-photo'));
    for(let i=0;i<photos.length;i++){
      if(isOperationCancelled())throw new Error('내보내기가 취소되었습니다.');
      const figure=photos[i],img=figure.querySelector('img'),thumb=img?.src,full=img?.dataset.fullUrl||thumb;if(!img||!full)continue;
      setStatus('사진 포함 '+(i+1)+'/'+photos.length);
      try{
        const fullData=await fetchAsDataUrl(full);if(isOperationCancelled())throw new Error('내보내기가 취소되었습니다.');
        const thumbData=!thumb||thumb===full?fullData:await fetchAsDataUrl(thumb);if(isOperationCancelled())throw new Error('내보내기가 취소되었습니다.');
        img.src=thumbData;img.dataset.fullUrl=fullData;figure.dataset.staged='true';delete figure.dataset.fullPath;delete figure.dataset.thumbPath;
      }catch(error){
        if(isOperationCancelled())throw error;
        failures.push((img.alt||'사진')+' · '+error.message);if(strict)throw error;
        if(img.src)img.src=new URL(img.src,location.href).href;if(img.dataset.fullUrl)img.dataset.fullUrl=new URL(img.dataset.fullUrl,location.href).href;
      }
    }
    normalized.html=template.innerHTML;return {state:normalized,failures};
  }
  function downloadHtml(source,name){const blob=new Blob([source],{type:'text/html;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
  function resetArtifactTheme(root,type){
    // Never copy the author's personal preference into a shared/exported document.
    root.removeAttribute('data-theme');root.removeAttribute('data-theme-preference');
    root.querySelector('meta[name="color-scheme"]').content='only light';
    root.querySelector('meta[name="theme-color"]').content='#142b3d';
    root.querySelectorAll('input[name="themePreference"]').forEach(input=>input.removeAttribute('checked'));
    const menu=root.querySelector('#themeMenu');if(menu)menu.hidden=true;
    root.querySelector('#themeToggle')?.setAttribute('aria-expanded','false');
    const status=root.querySelector('#themeStorageStatus');if(status){status.hidden=true;status.textContent='';}
    if(type==='readonly')root.querySelectorAll('.theme-toolbar,#tripThemeBootstrap').forEach(el=>el.remove());
  }
  function setArtifactBanner(root,type){resetArtifactTheme(root,type);root.querySelectorAll('#pwaRegistration,link[rel="manifest"],link[rel="icon"],link[rel="apple-touch-icon"]').forEach(el=>el.remove());root.querySelectorAll('.artifact-banner').forEach(el=>el.remove());const banner=document.createElement('div'),date=todayLocal();banner.className='artifact-banner '+(type==='readonly'?'readonly':'editable');banner.innerHTML=type==='readonly'?'<strong>인쇄·공유용 사본</strong><span>읽기 전용 · 온라인 반영 불가 · '+date+' 생성</span>':'<strong>오프라인 작업본</strong><span>인터넷 없이 수정 가능 · 수정 후 온라인 페이지에서 “편집본 불러오기”를 사용하세요.</span>';root.querySelector('header')?.insertAdjacentElement('afterend',banner);root.dataset.artifactType=type;}
  function embedTripConfig(root){const external=root.querySelector('#tripConfigScript,script[src$="trip-config.js"]');if(!external)return;const inline=document.createElement('script');inline.id='embeddedTripConfig';inline.textContent='window.TRIP_CONFIG='+JSON.stringify(CONFIG).replace(/</g,'\\u003c')+';';external.replaceWith(inline);}
  async function embedArtifactFont(root){
    root.querySelector('#tripFontPreload')?.remove();
    const style=root.querySelector('#trip-app-styles'),rule=style?.textContent.match(/@font-face\s*\{[^}]+\}/)?.[0],source=rule?.match(/url\("([^"]+)"\)/)?.[1];
    if(!source||source.startsWith('data:'))return;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000),signal=currentOperationSignal(),abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});
    try{
      if(signal?.aborted)controller.abort();
      const response=await fetch(new URL(source,document.baseURI),{signal:controller.signal});
      if(!response.ok)throw new Error('Font HTTP '+response.status);
      const data=await blobToDataUrl(new Blob([await response.arrayBuffer()],{type:'font/woff2'}));
      if(isOperationCancelled())throw new Error('작업을 취소했습니다.');
      style.textContent=style.textContent.replace(source,data);
    }catch(error){
      if(isOperationCancelled())throw error;
      style.textContent=style.textContent.replace(rule,'');console.warn('Export font unavailable; using the system font.',error);
    }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
  }
  async function exportOfflineHtml(sourceState=captureState()) {
    if(isOperationBusy())return;setOperationBusy(true,{cancelable:true,status:'오프라인 작업본 준비 중'});
    try {
      const embedded=await embedPhotos(sourceState),state=embedded.state,cloneDoc=document.documentElement.cloneNode(true);
      cloneDoc.dataset.offline='true';cloneDoc.dataset.offlineId=Date.now().toString(36);
      const cloneBody=cloneDoc.querySelector('body'),cloneMain=cloneDoc.querySelector('main'),cloneLoading=cloneDoc.querySelector('#appLoading');
      cloneBody.className='viewing offline-mode hydrating';cloneMain.innerHTML=state.html;cloneMain.setAttribute('aria-busy','true');
      cloneMain.hidden=false;cloneDoc.querySelector('#timetableView').hidden=true;cloneDoc.querySelector('#timetableGrid').innerHTML='';cloneDoc.querySelector('#timetableOverviewGrid').innerHTML='';cloneDoc.querySelector('#timetableDetail').hidden=true;cloneDoc.querySelector('#timetableDetailContent').innerHTML='';
      if(cloneLoading){cloneLoading.hidden=false;cloneLoading.removeAttribute('aria-hidden');}
      cloneDoc.querySelector('#offlineEmbeddedState').textContent=JSON.stringify(state).replace(/</g,'\\u003c');
      cloneDoc.querySelector('script[src*="supabase"]')?.remove();embedTripConfig(cloneDoc);stripTransient(cloneDoc);setArtifactBanner(cloneDoc,'editable');
      await embedArtifactFont(cloneDoc);
      const source='<!doctype html>\n'+cloneDoc.outerHTML,size=new Blob([source]).size;
      if(size>100*1024*1024){const choice=await showChoice({title:'오프라인 파일이 큽니다.',message:'사진을 포함한 파일 크기가 약 '+Math.ceil(size/1024/1024)+'MB입니다. 기기에 따라 열고 저장하는 데 시간이 걸릴 수 있습니다.',choices:[{label:'취소',value:'cancel'},{label:'계속 다운로드',value:'continue',className:'action-primary'}]});if(choice!=='continue'){setStatus('오프라인 작업본 생성을 취소했습니다.');return;}}
      downloadHtml(source,EXPORT_BASE_NAME+'_EDITABLE_'+todayLocal()+'.html');setStatus('오프라인 작업본을 만들었습니다.');
    } catch(error) {console.error(error);if(isOperationCancelled()){setStatus('오프라인 작업본 생성을 취소했습니다.');return;}setStatus('오프라인 작업본 생성 실패');await showChoice({title:'오프라인 작업본 생성 실패',message:error.message||'사진을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.',choices:[{label:'확인',value:'ok',className:'action-primary'}]});}
    finally{const status=$('#status').textContent;setOperationBusy(false);setStatus(status);}
  }
  function appendReadonlyRuntime(root){
    const script=document.createElement('script');script.id='readonlyRuntime';script.textContent=`(()=>{
      const q=(selector,scope=document)=>scope.querySelector(selector),qa=(selector,scope=document)=>Array.from(scope.querySelectorAll(selector));
      let lastPhotoTrigger=null;
      function sync(){
        qa('main .day').forEach(panel=>{const active=true;panel.classList.toggle('is-active',active);panel.hidden=!active;panel.setAttribute('aria-hidden',String(!active));});
      }
      function closeViewer(){const viewer=q('#photoViewer');if(!viewer)return;viewer.hidden=true;viewer.setAttribute('aria-hidden','true');lastPhotoTrigger?.focus();lastPhotoTrigger=null;}
      document.addEventListener('click',event=>{
        const img=event.target.closest?.('.schedule-photo:not(.map-capture) img');
        if(img){const viewer=q('#photoViewer'),viewerImage=q('#photoViewerImage');if(viewer&&viewerImage){lastPhotoTrigger=img;viewerImage.src=img.dataset.fullUrl||img.src;viewerImage.alt=img.alt||'일정 사진';viewer.hidden=false;viewer.setAttribute('aria-hidden','false');q('#photoViewerClose')?.focus();}}
        if(event.target.closest?.('#photoViewerClose'))closeViewer();
      });
      document.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&!q('#photoViewer')?.hidden){closeViewer();return;}
        const img=event.target.closest?.('.schedule-photo:not(.map-capture) img');if(img&&(event.key==='Enter'||event.key===' ')){event.preventDefault();img.click();}
      });
      q('#photoViewer')?.setAttribute('aria-hidden','true');sync();
    })();`;
    root.querySelector('body')?.appendChild(script);
  }
  async function exportStaticHtml(){
    if(isOperationBusy())return;setOperationBusy(true,{cancelable:true,status:'인쇄·공유용 사본 준비 중'});
    try{
      const embedded=await embedPhotos(captureState(),{strict:false}),cloneDoc=document.documentElement.cloneNode(true),photoData=new Map();
      const embeddedTemplate=document.createElement('template');embeddedTemplate.innerHTML=embedded.state.html;embeddedTemplate.content.querySelectorAll('.schedule-photo').forEach(figure=>{const img=figure.querySelector('img');photoData.set(figure.dataset.photoId,{src:img?.src||'',full:img?.dataset.fullUrl||img?.src||''});});
      cloneDoc.querySelectorAll('.schedule-photo').forEach(figure=>{const data=photoData.get(figure.dataset.photoId),img=figure.querySelector('img');if(data&&img){img.src=data.src;img.dataset.fullUrl=data.full;}});
      cloneDoc.querySelectorAll('script,#moneyPanelTemplate,.editor-bar,.auth-dialog,.notice-dialog,.version-dialog,.preview-banner,.app-loading,.tab-scroll').forEach(el=>el.remove());
      cloneDoc.querySelectorAll('.schedule-view-switch,.timetable-view,.bottom-nav,.tabs,.day-radio,#expenseCsvExport').forEach(el=>el.remove());cloneDoc.querySelector('main').hidden=false;
      cloneDoc.querySelectorAll('main .panel.day').forEach(panel=>{panel.removeAttribute('role');panel.removeAttribute('aria-labelledby');panel.removeAttribute('tabindex');});
      cloneDoc.querySelector('body').className='viewing';stripTransient(cloneDoc);cloneDoc.querySelectorAll('.expense-entry,.category-manager,.expense-actions').forEach(el=>el.remove());
      cloneDoc.querySelectorAll('main input,main select').forEach(control=>control.disabled=true);
      cloneDoc.querySelectorAll('input[type="checkbox"]').forEach((input,index)=>{if($$('main input[type="checkbox"]')[index]?.checked)input.setAttribute('checked','');else input.removeAttribute('checked');input.disabled=true;});
      setArtifactBanner(cloneDoc,'readonly');appendReadonlyRuntime(cloneDoc);await embedArtifactFont(cloneDoc);downloadHtml('<!doctype html>\n'+cloneDoc.outerHTML,EXPORT_BASE_NAME+'_VIEW_ONLY_'+todayLocal()+'.html');
      setStatus(embedded.failures.length?'공유용 사본 생성 · '+embedded.failures.length+'개 사진은 온라인 주소 사용':'사진 포함 공유용 사본 생성 완료');
    }catch(error){console.error(error);if(isOperationCancelled()){setStatus('인쇄·공유용 사본 생성을 취소했습니다.');return;}setStatus('인쇄·공유용 사본 생성 실패');await showChoice({title:'사본을 만들지 못했습니다.',message:error.message,choices:[{label:'확인',value:'ok',className:'action-primary'}]});}
    finally{const status=$('#status').textContent;setOperationBusy(false);setStatus(status);}
  }

function bindExportsControls(){
$('#exportMenuBtn').onclick=()=>showDialog($('#exportDialog'));
$('#exportBtn').onclick=()=>{$('#exportDialog').hidden=true;void exportStaticHtml();};
$('#offlineExportBtn').onclick=()=>{$('#exportDialog').hidden=true;void exportOfflineHtml();};
$('#exportCancel').onclick=()=>$('#exportDialog').hidden=true;
}

return Object.freeze({stripTransient,embedPhotos,downloadHtml,resetArtifactTheme,setArtifactBanner,embedTripConfig,embedArtifactFont,exportOfflineHtml,appendReadonlyRuntime,exportStaticHtml,bindExportsControls});
}
