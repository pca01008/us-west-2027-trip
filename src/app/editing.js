function createEditingController({$,$$,EDITOR_EMAIL,OFFLINE_MODE,SCHEMA_VERSION,TRIP_ID,applyState,applyStatePreservingInputs,blockUnsupportedDocument,body,buildDiff,captureState,clearCleanDraft,clearDraftRecord,clearSessionTimers,client,closeNotice,closePreview,closeScheduleTimeDialog,currentDraftRecord,dialogs,documentAdapter,documentSession,draftStorage,draftWorkflow,exportOfflineHtml,fetchPublishedState,fingerprint,flushDraftPersistence,getEditorSession,insertPlainText,invalidateVersionRequest,isChecklistSaving,materializeStagedPhotos,migratePublishedState,normalizeState,openChecklistEditor,openLedgerSettings,openVersions,pendingCheckCount,queueDraftPersistence,recoverOnlineDraft,resetImportSelection,resetInactivityTimer,resetLedgerSelection,resetPhotoSelection,resetVersionSelection,runtimeOptions,sessionService,setEditorSession,setPublishedBaseline,setStatus,showChoice,showDialog,signOutEditor,syncChecklistControls,tripRepository,updateContextControls,updateEditableEmpty,writeDraftRecord}) {
let authPurpose = 'edit';
let pendingAuthAction = null;
let pendingAuthCancel = null;
let saveInFlight = false;
async function showInactivityWarning(){dialogs.startNoticeCountdown();const dirty=isDirty();const choice=await showChoice({title:'자동 로그아웃 예정',message:dirty?'자동 로그아웃 후에도 초안은 이 브라우저에 보관됩니다.':'1분 안에 선택하지 않으면 자동 로그아웃합니다.',countdown:true,choices:dirty?[{label:'저장 후 로그아웃',value:'save',className:'action-primary'},{label:'계속 사용',value:'continue'},{label:'폐기 후 로그아웃',value:'discard',className:'action-danger'}]:[{label:'계속 사용',value:'continue',className:'action-primary'},{label:'로그아웃',value:'logout',className:'action-danger'}]});clearSessionTimers();if(choice==='save'){if(await saveAndFinish('자동 로그아웃 전 저장')){await signOutEditor();setStatus('변경사항을 저장하고 로그아웃했습니다.');}else resetInactivityTimer();}else if(choice==='continue')resetInactivityTimer();else if(choice==='discard')await discardAndLogout();else if(choice==='logout')await logoutPreservingDraft('로그아웃했습니다.');}

  function closeEditorDialogs(){invalidateVersionRequest();closeScheduleTimeDialog();['checklistDialog','ledgerSettingsDialog','categoryDialog','expenseDialog','mapDialog','photoEditDialog','importDialog','exportDialog','versionDialog','versionCompareDialog','photoViewer'].forEach(id=>{const dialog=$('#'+id);if(dialog)dialog.hidden=true;});resetLedgerSelection();resetPhotoSelection();resetVersionSelection();resetImportSelection();}
  async function handleExternalSignOut(message='편집 세션이 다른 탭에서 종료되었습니다.') {
    invalidateVersionRequest();
    const hadDraft=isDirty()||draftWorkflow.isRecoveryDeferred();
    if(hadDraft){
      await flushDraftPersistence();
      // The shared view no longer contains this draft. Require recovery before
      // another edit, and retain the guard across duplicate sign-out events.
      draftWorkflow.deferRecovery();
    }
    if(documentSession.snapshot().previewReturnState)closePreview();
    if(documentSession.snapshot().lastSavedState)applyState(documentSession.snapshot().lastSavedState);
    initializeHistory();setEditingUI(false,{preserveDraft:true});closeEditorDialogs();closeNotice('signed-out');setEditorSession(null);
    setStatus(hadDraft?message+($('#draftStorageWarning')&&!$('#draftStorageWarning').hidden?' 초안 보관에 실패했습니다. 새로고침 전에 로그인해 저장하거나 내보내세요.':' 초안은 이 브라우저에 보관했습니다.'):message);
  }
  async function logoutPreservingDraft(message){
    clearSessionTimers();
    await handleExternalSignOut(message);
    await signOutEditor();
  }
  async function requestManualLogout(){if(!sessionService.current()||OFFLINE_MODE)return;if(documentSession.snapshot().previewReturnState)closePreview();if(isDirty()){const choice=await showChoice({title:'로그아웃할까요?',message:'저장하지 않은 변경사항이 있습니다.',choices:[{label:'계속 사용',value:'continue'},{label:'폐기 후 로그아웃',value:'discard',className:'action-danger'},{label:'저장 후 로그아웃',value:'save',className:'action-primary'}]});if(choice!=='save'&&choice!=='discard')return;if(choice==='save'){if(!await saveAndFinish('로그아웃 전 저장'))return;}else{if(!await clearDraftRecord())return;if(documentSession.snapshot().lastSavedState)applyState(documentSession.snapshot().lastSavedState);}}setEditingUI(false);closeEditorDialogs();await signOutEditor();setStatus('편집자 로그아웃 완료');}
  async function discardDraft(message='수정 내용을 폐기했습니다.'){if(!await clearDraftRecord())return false;if(documentSession.snapshot().previewReturnState)closePreview();if(documentSession.snapshot().lastSavedState)applyState(documentSession.snapshot().lastSavedState);initializeHistory();setEditingUI(false);closeEditorDialogs();resetInactivityTimer();setStatus(message);return true;}
  async function discardAndLogout(message='수정 내용을 폐기하고 로그아웃했습니다.'){if(!await discardDraft(message)){resetInactivityTimer();return false;}closeNotice('timeout');await signOutEditor();setStatus(message);return true;}

function bindAuthentication(){
  $('#authCancel').onclick=()=>{$('#authDialog').hidden=true;const cancel=pendingAuthCancel;pendingAuthAction=null;pendingAuthCancel=null;if(cancel)cancel();};
  $('#authForm').onsubmit=async event=>{event.preventDefault();const submit=$('#authSubmit');if(submit.disabled)return;submit.disabled=true;$('#authError').textContent='';try{const {error}=await client.auth.signInWithPassword({email:EDITOR_EMAIL,password:$('#editorPassword').value});if(error){$('#authError').textContent=error.status>=500||error.name==='AuthRetryableFetchError'?'로그인 서버에 연결하지 못했습니다.':'비밀번호를 확인해 주세요.';return;}const session=await getEditorSession();if(!session){$('#authError').textContent='로그인 세션을 확인하지 못했습니다.';return;}$('#authDialog').hidden=true;await runPurpose(authPurpose);}catch(error){console.error(error);$('#authError').textContent='로그인 서버에 연결하지 못했습니다.';}finally{submit.disabled=false;}};
}

  function isRevisionConflict(error){return error?.code==='40001'||/revision conflict/i.test(String(error?.message||''));}
  function compactDiffMessage(groups){const items=groups.flatMap(group=>group.items.map(item=>group.title+' · '+item));return items.length?items.slice(0,4).join('\n')+(items.length>4?'\n외 '+(items.length-4)+'개 변경':''):'내용 구조가 변경되었습니다.';}
  async function resolveSaveConflict(localState,note){
    let remoteRow;
    try{remoteRow=await fetchPublishedState();}catch(error){console.error(error);setStatus('충돌 확인 실패 · 연결을 확인해 주세요.');return false;}
    if(!remoteRow?.content?.html){setStatus('최신 저장본을 확인하지 못했습니다.');return false;}
    const remoteState=normalizeState(migratePublishedState(remoteRow.content));
    documentSession.rememberRemote(remoteRow,remoteState);
    const groups=buildDiff(remoteState,localState);
    const choice=await showChoice({title:'다른 저장본이 먼저 반영되었습니다.',message:'자동 저장을 중단했습니다.\n\n'+compactDiffMessage(groups),choices:[{label:'계속 편집',value:'continue'},{label:'최신본으로 전환',value:'remote',className:'action-danger'},{label:'내 초안으로 덮어쓰기',value:'overwrite',className:'action-primary'}]});
    if(choice==='remote'){
      if(!await clearDraftRecord())return false;
      applyState(remoteState);setPublishedBaseline(remoteRow,remoteState);initializeHistory();updateDirtyState();setStatus('최신 저장본으로 전환했습니다.');return false;
    }
    if(choice==='overwrite'){
      documentSession.prepareOverwrite(remoteRow,remoteState);
      return persistState(localState,{note:'충돌 확인 후 저장'+(note?' · '+note:'')});
    }
    setStatus('내 초안을 유지했습니다. 저장 전 충돌을 다시 확인합니다.');return false;
  }
  async function persistState(state,{note='수동 저장'}={}){
    if(documentSession.snapshot().documentWriteBlock){setStatus(documentSession.snapshot().documentWriteBlock);return false;}
    if(body.classList.contains('previewing')){setStatus('미리보기를 닫은 뒤 저장해 주세요.');return false;}
    if(draftWorkflow.isRecoveryDeferred()){setStatus('보관한 초안을 복구하거나 삭제한 뒤 편집해 주세요.');return false;}
    if(saveInFlight||isOperationBusy()||isChecklistSaving()||pendingCheckCount()){setStatus('다른 작업이 끝난 뒤 저장해 주세요.');return false;}
    let normalized=normalizeState(state);
    if(OFFLINE_MODE){
      const saved=await writeDraftRecord({tripId:TRIP_ID,schemaVersion:SCHEMA_VERSION,state:normalized,baseState:normalized,baseRevision:documentSession.snapshot().publishedRevision,baseUpdatedAt:documentSession.snapshot().publishedUpdatedAt,savedAt:new Date().toISOString(),dirty:false});
      if(!saved){draftStorage.retainDraft(currentDraftRecord());return false;}
      documentSession.acceptOfflineSave(normalized);
      return {offline:true};
    }
    if(!client){setStatus('저장할 수 없습니다.');return false;}
    saveInFlight=true;setOperationBusy(true,{cancelable:true,status:'저장 준비 중'});
    let failure,timeout;
    try{
      normalized=await materializeStagedPhotos(normalized);
      if(isOperationCancelled())throw new Error('저장을 취소했습니다. 초안은 유지됩니다.');
      setOperationBusy(true,{cancelable:false,status:'공유 저장 중'});
      const controller=new AbortController();timeout=setTimeout(()=>controller.abort(),runtimeOptions.saveMs);
      let response;
      try{
        response=await tripRepository.saveDocument(normalized,documentSession.snapshot().publishedRevision,note,controller.signal);
      }catch(error){if(!controller.signal.aborted)throw error;}
      finally{clearTimeout(timeout);}
      if(controller.signal.aborted){
        // The server may have committed even though its response never arrived.
        // Reconcile once; never resend an uncertain write automatically.
        setStatus('저장 결과를 확인 중입니다.');
        let remoteRow;try{remoteRow=await fetchPublishedState();}catch(error){console.warn(error);}
        const remoteState=remoteRow?.content?.html?normalizeState(migratePublishedState(remoteRow.content)):null;
        if(remoteState&&fingerprint(remoteState)===fingerprint(normalized)){
          response={data:{revision:remoteRow.revision,updated_at:remoteRow.updated_at}};
        }else{
          if(remoteState)documentSession.rememberRemote(remoteRow,remoteState);
          throw new Error('저장 시간이 초과되었습니다. 초안은 유지됩니다. 연결을 확인한 뒤 다시 저장해 주세요.');
        }
      }
      const {data,error}=response;
      if(error)throw error;
      applyStatePreservingInputs(normalized);setPublishedBaseline({revision:Number(data?.revision)||documentSession.snapshot().publishedRevision+1,updated_at:data?.updated_at||new Date().toISOString()},normalized);documentSession.markClean();await clearDraftRecord();updateDirtyState();return data||{saved:true};
    }catch(error){failure=error;}
    finally{clearTimeout(timeout);saveInFlight=false;setOperationBusy(false);}
    if(isRevisionConflict(failure))return resolveSaveConflict(normalized,note);
    console.error(failure);await flushDraftPersistence();
    setStatus(failure?.message||'저장할 수 없습니다. 초안은 유지됩니다.');return false;
  }

  async function saveAndFinish(note='수동 저장'){const state=captureState(),wasEditing=body.classList.contains('editing');setEditingUI(false);const saved=await persistState(state,{note});if(!saved){const message=$('#status').textContent;updateDirtyState();if(wasEditing)setEditingUI(true);setStatus(message);return false;}initializeHistory();updateDirtyState();resetInactivityTimer();setStatus(OFFLINE_MODE?'오프라인 작업본 생성 중':'공유 저장 완료');if(OFFLINE_MODE)await exportOfflineHtml(documentSession.snapshot().lastSavedState);return true;}
  async function requestFinishEditing(){documentSession.cancelHistory();recordHistory();if(!isDirty()){setEditingUI(false);resetInactivityTimer();return;}setEditingUI(false);const choice=await showChoice({title:'편집을 완료할까요?',message:OFFLINE_MODE?'저장하면 수정된 오프라인 작업본을 새 파일로 내려받습니다.':'저장해야 공개 링크에 변경 내용이 반영됩니다.',input:OFFLINE_MODE?null:{label:'버전 메모 (선택)','placeholder':'예: 라스베이거스 일정 확정'},choices:[{label:'저장하고 종료',value:'save',className:'action-primary'},{label:'계속 편집',value:'continue'},{label:'변경사항 폐기',value:'discard',className:'action-danger'}]});if(choice==='save')await saveAndFinish(dialogs.inputValue()||'편집 완료');else if(choice==='continue'){setEditingUI(true);resetInactivityTimer();}else if(choice==='discard')discardDraft();}
  async function beginEditing(){if(!OFFLINE_MODE&&!documentSession.snapshot().pendingDraft){try{const published=await fetchPublishedState();if(published?.content?.html){const state=normalizeState(migratePublishedState(published.content));applyState(state);setPublishedBaseline(published,state);}}catch(error){if(blockUnsupportedDocument(error))return;console.warn(error);setStatus('최신 저장본 확인 실패 · 현재 화면에서 편집합니다.');}}setEditingUI(true);initializeHistory();resetInactivityTimer();setStatus(documentSession.snapshot().pendingDraft?'편집 중 · 저장되지 않음':'편집 모드');}
  function requestAuthentication(purpose){authPurpose=purpose;$('#authTitle').textContent=purpose==='edit'?'편집자 확인':purpose==='versions'?'버전 관리자 확인':purpose==='import'?'편집본 불러오기 권한 확인':purpose==='ledger-settings'?'가계부 설정 권한 확인':purpose==='checklist'?'체크리스트 편집자 확인':purpose==='ledger'?'가계부 편집자 확인':'저장 권한 확인';$('#authError').textContent='';$('#editorPassword').value='';showDialog($('#authDialog'));$('#editorPassword').focus();}
  async function runPurpose(purpose){
    if(documentSession.snapshot().documentWriteBlock&&purpose!=='versions'){pendingAuthAction=null;pendingAuthCancel?.();pendingAuthCancel=null;setStatus(documentSession.snapshot().documentWriteBlock);return;}
    const cancel=()=>{const action=pendingAuthCancel;pendingAuthAction=null;pendingAuthCancel=null;if(action)action();};
    if(body.classList.contains('previewing')&&purpose!=='versions'){cancel();setStatus('미리보기를 닫은 뒤 편집해 주세요.');return;}
    if(draftWorkflow.isRecoveryDeferred()&&['edit','ledger','ledger-settings','import','save'].includes(purpose)){
      await recoverOnlineDraft();
      if(draftWorkflow.isRecoveryDeferred()){cancel();return;}
    }
    resetInactivityTimer();if(purpose==='edit')await beginEditing();if(purpose==='versions')await openVersions();if(purpose==='save')await confirmSave();if(purpose==='ledger-settings')openLedgerSettings();if((purpose==='ledger'||purpose==='checklist'||purpose==='import')&&pendingAuthAction){const action=pendingAuthAction;pendingAuthAction=null;pendingAuthCancel=null;await action();}
  }
  async function requireEditor(purpose,action=null,cancelAction=null){if(action)pendingAuthAction=action;if(cancelAction)pendingAuthCancel=cancelAction;if(OFFLINE_MODE){await runPurpose(purpose);return;}if(!client){pendingAuthAction=null;const cancel=pendingAuthCancel;pendingAuthCancel=null;if(cancel)cancel();await showChoice({title:'편집할 수 없습니다.',message:'잠시 후 다시 시도해 주세요.',choices:[{label:'확인',value:'ok',className:'action-primary'}]});return;}if(await getEditorSession()){await runPurpose(purpose);return;}requestAuthentication(purpose);}


  function isDirty(){return documentSession.dirty(captureState());}
  function updateDirtyState({preserveDraft=false}={}){const {wasDirty,pendingDraft}=documentSession.updateDirty(captureState());$('#saveBtn').disabled=!pendingDraft;setStatus(body.classList.contains('editing')?(pendingDraft?'편집 중 · 저장되지 않음':'편집 모드'):(pendingDraft?'저장 대기 중':(OFFLINE_MODE?'오프라인 작업본':'보기 모드')));if(pendingDraft)queueDraftPersistence();else if(wasDirty&&!preserveDraft&&!body.classList.contains('hydrating'))clearCleanDraft();syncChecklistControls();}
  function setEditable(on){$$('main [contenteditable],.checklist label>span:not(.check-actions),.schedule-warning-text,main .day:not(.prepday):not(.moneyday) .day-head p').forEach(el=>el.contentEditable=on?'true':'false');$('#exchangeRate').disabled=true;$$('.check-actions,.time,.time [contenteditable]').forEach(el=>el.contentEditable='false');$$('.prepday [contenteditable]').forEach(el=>el.contentEditable='false');syncChecklistControls();if(!on)closeScheduleTimeDialog();}
  function recordHistory(){if(!body.classList.contains('editing')||documentAdapter.isApplying())return;if(!documentSession.recordLocalChange(captureState()))return;updateHistoryControls();updateDirtyState();}
  function queueHistory(){updateDirtyState();if(documentSession.snapshot().pendingDraft)void flushDraftPersistence();documentSession.queueHistory(recordHistory);}
  function initializeHistory(){documentSession.initializeHistory(captureState());updateHistoryControls();}
  function updateHistoryControls(){const {historyIndex,historyLength}=documentSession.snapshot();$('#undoBtn').disabled=historyIndex<=0;$('#redoBtn').disabled=historyIndex<0||historyIndex>=historyLength-1;}
  function moveHistory(offset){documentSession.cancelHistory();recordHistory();const next=documentSession.moveHistory(offset);if(!next)return;applyState(next);updateHistoryControls();updateDirtyState();resetInactivityTimer();}



  function setEditingUI(on,options){body.classList.toggle('editing',on);body.classList.toggle('viewing',!on);setEditable(on);updateContextControls();updateDirtyState(options);}

function finishMutation(){if(body.classList.contains('editing'))recordHistory();else updateDirtyState();resetInactivityTimer();}
function isSaveInFlight(){return saveInFlight;}

function bindEditingControls(){
function refreshEditablePlaceholder(event){const element=event.target.closest?.('[contenteditable="true"][data-placeholder]');if(element)updateEditableEmpty(element);}
$('#editBtn').onclick=async()=>{if(body.classList.contains('editing')){await requestFinishEditing();return;}if(body.classList.contains('previewing'))closePreview();if($('.day-radio:checked')?.id==='prep'){await requireEditor('checklist',openChecklistEditor);return;}await requireEditor($('.day-radio:checked')?.id==='money'?'ledger-settings':'edit');};
$('#logoutBtn').onclick=requestManualLogout;
$('#undoBtn').onclick=()=>moveHistory(-1);
$('#redoBtn').onclick=()=>moveHistory(1);
$('#resetBtn').onclick=resetDraft;
$('#saveBtn').onclick=()=>requireEditor('save');
$('#cancelOperationBtn').onclick=cancelCurrentOperation;
document.addEventListener('paste',event=>{const target=event.target.closest?.('[contenteditable="true"]');if(!target)return;event.preventDefault();const text=event.clipboardData?.getData('text/plain')||'';insertPlainText(target,text);});
document.addEventListener('compositionend',refreshEditablePlaceholder);
document.addEventListener('input',event=>{refreshEditablePlaceholder(event);if(body.classList.contains('editing')&&event.target.closest('main')&&!event.target.closest('.add-expense')&&event.target.id!=='exchangeRate')queueHistory();});
document.addEventListener('change',async event=>{if(body.classList.contains('editing')&&event.target.closest('main')&&!event.target.closest('.add-expense')&&event.target.id!=='exchangeRate')recordHistory();});
}

async function resetDraft(){const choice=await showChoice({title:'마지막 저장본으로 초기화',message:'현재 변경을 삭제하고 마지막 저장본으로 되돌립니다.',choices:[{label:'취소',value:'cancel'},{label:'초기화',value:'reset',className:'action-danger'}]});if(choice==='reset')discardDraft('마지막 저장본으로 초기화했습니다.');}

async function confirmSave(){if(!documentSession.snapshot().pendingDraft){setStatus('저장할 변경이 없습니다.');return;}const choice=await showChoice({title:OFFLINE_MODE?'오프라인 작업본 저장':'공유 일정에 저장',message:OFFLINE_MODE?'수정된 내용을 포함한 새 작업본을 내려받습니다.':'저장하면 공개 링크에 변경 내용이 반영됩니다.',input:OFFLINE_MODE?null:{label:'버전 메모 (선택)','placeholder':'예: 항공편 시간 수정'},choices:[{label:'취소',value:'cancel'},{label:'저장',value:'save',className:'action-primary'}]});if(choice==='save')await saveAndFinish(dialogs.inputValue()||'수동 저장');}
let operationBusy = false;
let operationCancelled = false;
let operationController = null;
function setOperationBusy(on,{cancelable=false,status=''}={}) {
    if(on&&!operationBusy)operationController=new AbortController();
    if(!on){operationController?.abort();operationController=null;}
    operationBusy=on;operationCancelled=false;body.classList.toggle('operation-busy',on);
    const cancel=$('#cancelOperationBtn');if(cancel){cancel.classList.toggle('hidden',!on||!cancelable);cancel.disabled=!on||!cancelable;}
    $('.editor-bar')?.setAttribute('aria-busy',String(on));
    if(status)setStatus(status);
    if(!on){updateHistoryControls();updateDirtyState();}
  }

function cancelCurrentOperation(){const button=$('#cancelOperationBtn');if(!operationBusy||!button||button.disabled)return;operationCancelled=true;operationController?.abort(new Error('작업을 취소했습니다. 초안은 유지됩니다.'));button.disabled=true;setStatus('작업을 취소하는 중입니다.');}

function isOperationBusy(){return operationBusy;}

function isOperationCancelled(){return operationCancelled;}

function currentOperationSignal(){return operationController?.signal;}
return Object.freeze({setOperationBusy,cancelCurrentOperation,isOperationBusy,isOperationCancelled,currentOperationSignal,resetDraft,confirmSave,showInactivityWarning,closeEditorDialogs,handleExternalSignOut,logoutPreservingDraft,requestManualLogout,discardDraft,discardAndLogout,bindAuthentication,isRevisionConflict,compactDiffMessage,resolveSaveConflict,persistState,saveAndFinish,requestFinishEditing,beginEditing,requestAuthentication,runPurpose,requireEditor,isDirty,updateDirtyState,setEditable,recordHistory,queueHistory,initializeHistory,updateHistoryControls,moveHistory,setEditingUI,finishMutation,isSaveInFlight,bindEditingControls});
}
