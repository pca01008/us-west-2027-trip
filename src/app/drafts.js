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
function writePublicCache(state,metadata={}){
  const baseline=documentSession.snapshot();
  return draftStorage.writePublicCache(state,{...metadata,revision:metadata.revision??baseline.publishedRevision,updatedAt:metadata.updatedAt??baseline.publishedUpdatedAt});
}
  // A synchronous checkpoint covers navigation before an IndexedDB commit.
  // It uses the same per-page ownership/claim rules as the durable draft.

  function showDraftStorageWarning(kind='') {
    let warning=$('#draftStorageWarning');
    if(!warning){warning=document.createElement('span');warning.id='draftStorageWarning';warning.className='chip';warning.setAttribute('role','alert');$('#status').after(warning);}
    warning.hidden=!kind;
    warning.textContent=kind==='delete'?'초안 삭제 실패 · 저장 공간을 확인한 뒤 다시 시도해 주세요.':kind==='read'?'브라우저 초안을 확인하지 못했습니다 · 저장 공간을 확인해 주세요.':kind?'초안 보관 실패 · 새로고침 전에 공유 저장하거나 내보내세요.':'';
  }
  // A live page owns its record until its Web Lock is released on unload.
  // Recovery only moves records whose owner is no longer open.

  function setPublishedBaseline(row,state,cacheMetadata={}) {
    const normalized=normalizeState(state),current=normalizeState(captureState());
    documentSession.acceptPublished(row,fingerprint(current)===fingerprint(normalized)?normalized:current);
    void writePublicCache(documentSession.snapshot().lastSavedState,cacheMetadata);
  }
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
