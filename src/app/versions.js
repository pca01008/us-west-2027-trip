function createVersionsController({$,OFFLINE_MODE,body,buildDiff,captureState,clone,closePreview,documentSession,draftWorkflow,enterHistoricalPreview,escapeHtml,flushDraftPersistence,initializeHistory,isChecklistSaving,isDirty,isOperationBusy,isSaveInFlight,migratePublishedState,normalizeState,pendingCheckCount,persistState,recordHistory,recoverOnlineDraft,renderDiff,requireEditor,resetInactivityTimer,runtimeOptions,sessionService,setStatus,showChoice,showDialog,tripRepository}) {
let selectedVersion = null;
let versionRequest = null;
const versionContentCache = new Map();











  function formatBytes(value){const size=Number(value)||0;if(size<1024)return size+' B';if(size<1024*1024)return (size/1024).toFixed(1)+' KB';return (size/1024/1024).toFixed(1)+' MB';}
  function invalidateVersionRequest(){const request=versionRequest;versionRequest=null;request?.controller.abort();}
  function beginVersionRequest(){invalidateVersionRequest();return versionRequest={controller:new AbortController()};}
  function isCurrentVersionRequest(request){return versionRequest===request&&Boolean(sessionService.current())&&!sessionService.isSigningOut()&&!$('#versionDialog').hidden;}
  function setVersionLoadStatus(message=''){const status=$('#versionLoadStatus');status.textContent=message;status.hidden=!message;}
  function closeVersions(){invalidateVersionRequest();$('#versionDialog').hidden=true;$('#versionCompareDialog').hidden=true;selectedVersion=null;setVersionLoadStatus();resetInactivityTimer();}
  async function readVersionRequest(task,request){
    const signal=request.controller.signal;
    let rejectAbort;
    const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(signal.reason||new Error('버전 불러오기를 취소했습니다.'));signal.addEventListener('abort',rejectAbort,{once:true});if(signal.aborted)rejectAbort();});
    const timeout=setTimeout(()=>request.controller.abort(new Error('불러오기 시간이 초과되었습니다. 다시 시도해 주세요.')),runtimeOptions.versionReadMs);
    try{const result=await Promise.race([task(signal),aborted]);if(result.error)throw result.error;return result.data;}
    finally{clearTimeout(timeout);signal.removeEventListener('abort',rejectAbort);}
  }
  function showVersionLoadError(error,request){if(!isCurrentVersionRequest(request))return;console.error(error);setVersionLoadStatus(request.controller.signal.aborted?request.controller.signal.reason.message:'버전을 불러오지 못했습니다. 다시 시도해 주세요.');}
  async function loadVersionContent(version,request){
    if(versionContentCache.has(version.id))return clone(versionContentCache.get(version.id));
    const data=await readVersionRequest(signal=>tripRepository.readVersionContent(version.id,signal),request);
    if(!isCurrentVersionRequest(request))return null;
    if(!data?.content)throw new Error('버전 본문이 없습니다.');
    const state=normalizeState(migratePublishedState(data.content));versionContentCache.set(version.id,state);while(versionContentCache.size>5)versionContentCache.delete(versionContentCache.keys().next().value);return clone(state);
  }
  async function previewVersion(version){
    if(isSaveInFlight()||isOperationBusy()||isChecklistSaving()||pendingCheckCount())return;
    const request=beginVersionRequest();setVersionLoadStatus('버전 #'+version.id+' 불러오는 중');
    try{
      const state=await loadVersionContent(version,request);
      if(!isCurrentVersionRequest(request)||isSaveInFlight()||isOperationBusy()||isChecklistSaving()||pendingCheckCount())return;
      documentSession.cancelHistory();recordHistory();await flushDraftPersistence();
      if(!isCurrentVersionRequest(request)||isSaveInFlight()||isOperationBusy()||isChecklistSaving()||pendingCheckCount())return;
      // Keep the original working copy even when switching between previews.
      enterHistoricalPreview(state);
      $('#previewLabel').textContent='버전 #'+version.id+' · '+new Date(version.created_at).toLocaleString('ko-KR')+' 미리보기';
      closeVersions();setStatus('과거 저장본 미리보기 · 편집하려면 미리보기를 닫아 주세요.');
    }catch(error){showVersionLoadError(error,request);}
  }
  async function compareVersion(version){
    const request=beginVersionRequest();selectedVersion=null;setVersionLoadStatus('버전 #'+version.id+' 불러오는 중');
    try{const state=await loadVersionContent(version,request);if(!isCurrentVersionRequest(request))return;const groups=buildDiff(captureState(),state);selectedVersion={...version,state};$('#versionCompareTitle').textContent='버전 #'+version.id+' 차이';renderDiff($('#versionCompareSummary'),$('#versionCompareDiff'),groups,(version.note?version.note+' · ':'')+new Date(version.created_at).toLocaleString('ko-KR')+' 저장본과 현재 화면 비교');setVersionLoadStatus();showDialog($('#versionCompareDialog'));}
    catch(error){showVersionLoadError(error,request);}
  }
  async function restoreSelectedVersion(){
    if(!selectedVersion)return;
    if(draftWorkflow.isRecoveryDeferred()){if(documentSession.snapshot().previewReturnState)closePreview();await recoverOnlineDraft();if(draftWorkflow.isRecoveryDeferred())return;}
    const hasDraft=isDirty(),choice=await showChoice({title:'버전 #'+selectedVersion.id+'을 복원할까요?',message:hasDraft?'현재 저장하지 않은 초안은 복원본으로 대체됩니다. 복원본은 새 버전으로 저장되어 공개됩니다.':'복원본은 새 버전으로 저장되어 공개됩니다.',choices:[{label:'취소',value:'cancel'},{label:'복원',value:'restore',className:'action-primary'}]});
    if(choice!=='restore')return;
    const restored=clone(selectedVersion.state),id=selectedVersion.id;
    if(body.classList.contains('previewing'))closePreview();
    if(await persistState(restored,{note:'버전 #'+id+' 복원'})){initializeHistory();$('#versionCompareDialog').hidden=true;$('#versionDialog').hidden=true;selectedVersion=null;setStatus('버전 #'+id+'을 새 저장본으로 복원했습니다.');}
  }
  async function openVersions(){
    if(OFFLINE_MODE||!sessionService.current()||sessionService.isSigningOut())return;
    const request=beginVersionRequest(),list=$('#versionList');selectedVersion=null;$('#versionCompareDialog').hidden=true;setVersionLoadStatus();list.innerHTML='<div class="version-empty">저장 목록을 불러오는 중입니다.</div>';showDialog($('#versionDialog'));
    try{
      const data=await readVersionRequest(signal=>tripRepository.readVersionMetadata(signal),request);
      if(!isCurrentVersionRequest(request))return;
      list.innerHTML=data.length?'':'<div class="version-empty">아직 저장된 버전이 없습니다.</div>';
      data.forEach(version=>{const item=document.createElement('div');item.className='version-item';item.innerHTML='<div><strong>'+escapeHtml(version.note||'버전 #'+version.id)+'</strong><small>#'+version.id+' · '+escapeHtml(new Date(version.created_at).toLocaleString('ko-KR'))+' · '+escapeHtml(formatBytes(version.content_size))+'</small></div><button class="action-muted" type="button">비교</button><button class="action-muted" type="button">미리보기</button><button class="action-primary" type="button">복원</button>';const buttons=item.querySelectorAll('button');buttons[0].onclick=()=>compareVersion(version);buttons[1].onclick=()=>previewVersion(version);buttons[2].onclick=()=>compareVersion(version);list.appendChild(item);});
    }catch(error){if(!isCurrentVersionRequest(request))return;list.innerHTML='<div class="version-empty">닫고 다시 열어 주세요.</div>';showVersionLoadError(error,request);}
  }


function resetVersionSelection(){selectedVersion=null;}


function bindVersionsControls(){
$('#versionsBtn').onclick=()=>requireEditor('versions');
$('#closePreviewBtn').onclick=closePreview;
$('#closeVersionsBtn').onclick=closeVersions;
$('#versionCompareClose').onclick=()=>{invalidateVersionRequest();$('#versionCompareDialog').hidden=true;selectedVersion=null;};
$('#versionCompareRestore').onclick=restoreSelectedVersion;
}



return Object.freeze({formatBytes,invalidateVersionRequest,beginVersionRequest,isCurrentVersionRequest,setVersionLoadStatus,closeVersions,readVersionRequest,showVersionLoadError,loadVersionContent,previewVersion,compareVersion,restoreSelectedVersion,openVersions,resetVersionSelection,bindVersionsControls});
}
