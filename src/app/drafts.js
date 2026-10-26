/** Draft scheduling and recovery policy; storage mechanics have a separate owner. */
function createDraftWorkflow({OFFLINE_MODE,SCHEMA_VERSION,TRIP_ID,applyState,body,captureState,clone,documentSession,draftStorage,fingerprint,getEditorSession,initializeHistory,isDirty,migratePublishedState,normalizeState,readDraftRecord,setStatus,showChoice,updateDirtyState}) {
let deferredDraftRecovery=false,draftWriteTimer=null;
// Workflow guards run before the storage call, preserving synchronous checkpoints.
function writeDraftRecord(record){
  if(documentSession.snapshot().documentWriteBlock||deferredDraftRecovery)return Promise.resolve(false);
  return draftStorage.writeDraftRecord(record);
}
async function clearDraftRecord(){
  if(documentSession.snapshot().documentWriteBlock)return false;
  clearTimeout(draftWriteTimer);draftWriteTimer=null;
  const cleared=await draftStorage.clearDraftRecord();
  if(cleared)deferredDraftRecovery=false;
  return cleared;
}

  // A synchronous checkpoint covers navigation before an IndexedDB commit.
  // It uses the same per-page ownership/claim rules as the durable draft.


  // A live page owns its record until its Web Lock is released on unload.
  // Recovery only moves records whose owner is no longer open.


  function currentDraftRecord() {
    return {tripId:TRIP_ID,schemaVersion:SCHEMA_VERSION,state:documentSession.snapshot().previewReturnState?clone(documentSession.snapshot().previewReturnState):captureState(),baseState:documentSession.snapshot().draftBaselineUnknown?null:clone(documentSession.snapshot().lastSavedState),baseRevision:documentSession.snapshot().publishedRevision,baseUpdatedAt:documentSession.snapshot().publishedUpdatedAt,savedAt:new Date().toISOString(),dirty:true};
  }
  async function flushDraftPersistence() {
    clearTimeout(draftWriteTimer);
    if(!documentSession.snapshot().lastSavedState||!isDirty())return false;
    return writeDraftRecord(currentDraftRecord());
  }
  function queueDraftPersistence() {
    clearTimeout(draftWriteTimer);
    if(!documentSession.snapshot().pendingDraft||!documentSession.snapshot().lastSavedState||body.classList.contains('hydrating'))return;
    draftWriteTimer=setTimeout(()=>{
      if(documentSession.snapshot().pendingDraft)void writeDraftRecord(currentDraftRecord());
    },700);
  }

  function clearCleanDraft() {
    if(deferredDraftRecovery)return;
    // Offline saved changes live in IndexedDB too. Keep their clean baseline
    // rather than reverting to the file's older embedded state on reload.
    draftStorage.invalidateWrites();clearTimeout(draftWriteTimer);draftWriteTimer=null;
    if(OFFLINE_MODE)void writeDraftRecord({...currentDraftRecord(),dirty:false});
    else void clearDraftRecord();
  }

async function recoverOnlineDraft() {
    const record=await readDraftRecord();
    if(!record?.dirty||record.tripId!==TRIP_ID||!record.state?.html){deferredDraftRecovery=false;return;}
    const incoming=normalizeState(migratePublishedState(record.state));
    if(documentSession.snapshot().lastSavedState&&fingerprint(incoming)===fingerprint(documentSession.snapshot().lastSavedState)){documentSession.markClean();await clearDraftRecord();return;}
    if(!await getEditorSession()){
      deferredDraftRecovery=true;
      setStatus('초안을 보관했습니다 · 로그인 후 복구할 수 있습니다.');
      return;
    }
    const serverChanged=Number(record.baseRevision||0)!==documentSession.snapshot().publishedRevision;
    const savedAt=record.savedAt?new Date(record.savedAt).toLocaleString('ko-KR'):'이전 접속';
    const choice=await showChoice({title:'저장하지 않은 초안을 찾았습니다.',message:savedAt+'에 이 브라우저에 보관한 초안입니다.'+(serverChanged?' 그 뒤 공유 저장본이 변경되어 저장할 때 차이를 다시 확인합니다.':''),choices:[{label:'초안 삭제',value:'discard',className:'action-danger'},{label:'초안 복구',value:'restore',className:'action-primary'}]});
    if(choice==='discard'){
      documentSession.markClean();
      if(documentSession.snapshot().lastSavedState){applyState(documentSession.snapshot().lastSavedState);documentSession.establishBaseline(clone(normalizeState(captureState())));}
      initializeHistory();
      const cleared=await clearDraftRecord();
      if(!cleared)deferredDraftRecovery=true;
      updateDirtyState();
      if(cleared)setStatus('브라우저 초안을 삭제했습니다.');
      else await showChoice({title:'초안을 삭제하지 못했습니다.',message:'브라우저 저장소에서 초안을 지우지 못했습니다. 사이트 저장 공간을 확인한 뒤 다시 시도해 주세요.',choices:[{label:'확인',value:'ok',className:'action-primary'}]});
      return;
    }
    // Dismissing recovery keeps the stored draft and the current shared view.
    if(choice!=='restore'){deferredDraftRecovery=true;setStatus('초안을 이 브라우저에 보관했습니다.');return;}
    deferredDraftRecovery=false;
    const latestState=clone(documentSession.snapshot().lastSavedState),latestRow={revision:documentSession.snapshot().publishedRevision,updated_at:documentSession.snapshot().publishedUpdatedAt,content:latestState};
    // A legacy draft without a baseline must not adopt a newer revision through
    // a checklist patch. Keep that uncertainty across subsequent draft writes.
    documentSession.restoreDraftBaseline({baseline:record.baseState?.html?normalizeState(migratePublishedState(record.baseState)):latestState,revision:record.baseRevision,updatedAt:record.baseUpdatedAt,unknown:serverChanged&&!record.baseState?.html,remote:serverChanged?{row:latestRow,state:latestState}:null});
    applyState(incoming);initializeHistory();updateDirtyState();setStatus('초안 복구됨 · 저장되지 않음');
  }
function deferRecovery(){deferredDraftRecovery=true;}
function isRecoveryDeferred(){return deferredDraftRecovery;}
function cancelPendingWrites(){clearTimeout(draftWriteTimer);draftWriteTimer=null;}

return Object.freeze({writeDraftRecord,clearDraftRecord,currentDraftRecord,flushDraftPersistence,queueDraftPersistence,clearCleanDraft,recoverOnlineDraft,deferRecovery,isRecoveryDeferred,cancelPendingWrites});
}
