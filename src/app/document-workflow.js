function createDocumentController({$,OFFLINE_MODE,applyState,applyStatePreservingInputs,blockUnsupportedDocument,body,cancelTabScrollRelease,captureState,disposeTimetable,disposeTripClocks,checklistEditorDirty,client,clone,dialogs,documentSession,draftStorage,fetchPublishedState,fingerprint,finishHydration,flushDraftPersistence,getEditorSession,initializeHistory,isChecklistEditorSaving,isChecklistSaving,isDirty,isSaveInFlight,migratePublishedState,normalizeState,pendingCheckCount,readDraftRecord,readPublicCache,recoverOnlineDraft,sessionService,setStatus,tripRepository,updateDirtyState}) {

function writePublicCache(state,metadata={}){
  const baseline=documentSession.snapshot();
  return draftStorage.writePublicCache(state,{...metadata,revision:metadata.revision??baseline.publishedRevision,updatedAt:metadata.updatedAt??baseline.publishedUpdatedAt});
}



function setPublishedBaseline(row,state,cacheMetadata={}) {
    const normalized=normalizeState(state),current=normalizeState(captureState());
    documentSession.acceptPublished(row,fingerprint(current)===fingerprint(normalized)?normalized:current);
    void writePublicCache(documentSession.snapshot().lastSavedState,cacheMetadata);
  }

async function refreshPublishedState(reason='refresh') {
    if(OFFLINE_MODE||!client||!navigator.onLine)return false;
    try{
      const row=await fetchPublishedState();if(!row?.content?.html)return false;
      const revision=Math.max(0,Number(row.revision)||0),state=normalizeState(migratePublishedState(row.content));
      if(body.classList.contains('editing')||documentSession.snapshot().pendingDraft||body.classList.contains('previewing')||isChecklistSaving()||pendingCheckCount()||!$('#checklistDialog').hidden){
        if(revision!==documentSession.snapshot().publishedRevision){documentSession.rememberRemote(row,state);setStatus('새 공유 저장본이 있습니다 · 저장 시 비교합니다.');}
        return true;
      }
      if(revision!==documentSession.snapshot().publishedRevision||fingerprint(state)!==fingerprint(documentSession.snapshot().lastSavedState)){applyStatePreservingInputs(state);setPublishedBaseline(row,state);initializeHistory();setStatus(reason==='reconnect'?'연결 복구 · 최신 저장본 반영':'최신 저장본을 반영했습니다.');}
      else if(reason==='reconnect')setStatus('공유 서버 연결 복구 · 최신 상태');
      return true;
    }catch(error){if(blockUnsupportedDocument(error))return false;console.warn(error);setStatus('공유 서버 확인 실패 · 현재 화면 유지');return false;}
  }

async function hydrate(){
    if(OFFLINE_MODE){
      body.classList.add('offline-mode');
      let embedded=null;try{embedded=JSON.parse($('#offlineEmbeddedState').textContent||'null');}catch(error){console.warn(error);}
      const record=await readDraftRecord();
      const embeddedState=normalizeState(embedded?.html?migratePublishedState(embedded):captureState());
      if(record?.state?.html){
        const restored=normalizeState(migratePublishedState(record.state));
        documentSession.establishBaseline(normalizeState(record.dirty&&record.baseState?.html?migratePublishedState(record.baseState):restored));
        applyState(restored);
        setStatus(record.dirty?'저장하지 않은 오프라인 초안을 복구했습니다.':'오프라인 작업본');
      }else{applyState(embeddedState);documentSession.establishBaseline(clone(embeddedState));}
      initializeHistory();updateDirtyState();finishHydration();return;
    }

    let loadedFromCache=false,cacheStatus='';
    try{
      if(!client||!navigator.onLine)throw new Error('공유 서버에 연결할 수 없습니다.');
      const published=await fetchPublishedState();
      if(published?.content?.html){const state=normalizeState(migratePublishedState(published.content));applyState(state);setPublishedBaseline(published,state);}
    }catch(error){
      if(blockUnsupportedDocument(error))return;
      console.warn(error);const cached=await readPublicCache();
      if(cached?.state?.html){const state=normalizeState(migratePublishedState(cached.state));applyState(state);setPublishedBaseline({revision:cached.revision,updatedAt:cached.updatedAt},state,cached);loadedFromCache=true;const cachedLabel=cached.cachedAt?new Date(cached.cachedAt).toLocaleString('ko-KR'):'최근';cacheStatus='오프라인 캐시 표시 · '+cachedLabel+' 기준';}
      else cacheStatus='연결 실패 · 기본 일정 표시 중 · 최신 공유본 미확인';
    }
    if(!documentSession.snapshot().lastSavedState)documentSession.establishBaseline(normalizeState(captureState()));
    initializeHistory();updateDirtyState();if(cacheStatus)setStatus(cacheStatus);await recoverOnlineDraft();finishHydration();
    if(!client)return;
    tripRepository.subscribe(payload=>{
      if(!payload.new?.content?.html)return;
      let remoteState;try{remoteState=normalizeState(migratePublishedState(payload.new.content));}catch(error){blockUnsupportedDocument(error);console.warn(error);return;}
      if(body.classList.contains('editing')||documentSession.snapshot().pendingDraft||body.classList.contains('previewing')||isChecklistSaving()||pendingCheckCount()||!$('#checklistDialog').hidden){documentSession.rememberRemote(payload.new,remoteState);setStatus('새 공유 저장본이 있습니다 · 저장 시 비교합니다.');return;}
      applyStatePreservingInputs(remoteState);setPublishedBaseline(payload.new,remoteState);initializeHistory();setStatus('새 저장본을 반영했습니다.');
    },status=>{if(status==='SUBSCRIBED'&&loadedFromCache)void refreshPublishedState('reconnect');});
    await getEditorSession();
  }
function bindDocumentControls(){
window.addEventListener('online',()=>void refreshPublishedState('reconnect'));
window.addEventListener('offline',()=>setStatus(documentSession.snapshot().pendingDraft?'오프라인 · 초안은 이 브라우저에 보관 중':'오프라인 · 저장된 화면 표시 중'));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshPublishedState('visible');else void flushDraftPersistence();});
window.addEventListener('pagehide',event=>{void flushDraftPersistence();if(!event.persisted){tripRepository.dispose();sessionService.dispose();dialogs.dispose();disposeTimetable();disposeTripClocks();cancelTabScrollRelease();documentSession.cancelHistory();}});
window.addEventListener('beforeunload',event=>{if(!isDirty()&&!isSaveInFlight()&&!pendingCheckCount()&&!isChecklistEditorSaving()&&!checklistEditorDirty())return;void flushDraftPersistence();event.preventDefault();event.returnValue='';});
}

return Object.freeze({writePublicCache,setPublishedBaseline,refreshPublishedState,hydrate,bindDocumentControls});
}
