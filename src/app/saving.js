  function isRevisionConflict(error){return error?.code==='40001'||/revision conflict/i.test(String(error?.message||''));}
  function compactDiffMessage(groups){const items=groups.flatMap(group=>group.items.map(item=>group.title+' · '+item));return items.length?items.slice(0,4).join('\n')+(items.length>4?'\n외 '+(items.length-4)+'개 변경':''):'내용 구조가 변경되었습니다.';}
  async function resolveSaveConflict(localState,note){
    let remoteRow;
    try{remoteRow=await fetchPublishedState();}catch(error){console.error(error);setStatus('충돌 확인 실패 · 연결을 확인해 주세요.');return false;}
    if(!remoteRow?.content?.html){setStatus('최신 저장본을 확인하지 못했습니다.');return false;}
    const remoteState=normalizeState(migratePublishedState(remoteRow.content));
    pendingRemoteState={row:remoteRow,state:remoteState};
    const groups=buildDiff(remoteState,localState);
    const choice=await showChoice({title:'다른 저장본이 먼저 반영되었습니다.',message:'자동 저장을 중단했습니다.\n\n'+compactDiffMessage(groups),choices:[{label:'계속 편집',value:'continue'},{label:'최신본으로 전환',value:'remote',className:'action-danger'},{label:'내 초안으로 덮어쓰기',value:'overwrite',className:'action-primary'}]});
    if(choice==='remote'){
      if(!await clearDraftRecord())return false;
      applyState(remoteState);setPublishedBaseline(remoteRow,remoteState);initializeHistory();updateDirtyState();setStatus('최신 저장본으로 전환했습니다.');return false;
    }
    if(choice==='overwrite'){
      lastSavedState=clone(remoteState);draftBaselineUnknown=false;
      publishedRevision=Math.max(0,Number(remoteRow.revision)||0);publishedUpdatedAt=String(remoteRow.updated_at||'');pendingRemoteState=null;
      return persistState(localState,{note:'충돌 확인 후 저장'+(note?' · '+note:'')});
    }
    setStatus('내 초안을 유지했습니다. 저장 전 충돌을 다시 확인합니다.');return false;
  }
  async function persistState(state,{note='수동 저장'}={}){
    if(documentWriteBlock){setStatus(documentWriteBlock);return false;}
    if(body.classList.contains('previewing')){setStatus('미리보기를 닫은 뒤 저장해 주세요.');return false;}
    if(deferredDraftRecovery){setStatus('보관한 초안을 복구하거나 삭제한 뒤 편집해 주세요.');return false;}
    if(saveInFlight||operationBusy||checklistSaving||pendingChecks.size){setStatus('다른 작업이 끝난 뒤 저장해 주세요.');return false;}
    let normalized=normalizeState(state);
    if(OFFLINE_MODE){
      const saved=await writeDraftRecord({tripId:TRIP_ID,schemaVersion:SCHEMA_VERSION,state:normalized,baseState:normalized,baseRevision:publishedRevision,baseUpdatedAt:publishedUpdatedAt,savedAt:new Date().toISOString(),dirty:false});
      if(!saved){memoryDraftRecord=currentDraftRecord();return false;}
      lastSavedState=clone(normalized);pendingDraft=false;
      return {offline:true};
    }
    if(!client){setStatus('저장할 수 없습니다.');return false;}
    saveInFlight=true;setOperationBusy(true,{cancelable:true,status:'저장 준비 중'});
    let failure,timeout;
    try{
      normalized=await materializeStagedPhotos(normalized);
      if(operationCancelled)throw new Error('저장을 취소했습니다. 초안은 유지됩니다.');
      setOperationBusy(true,{cancelable:false,status:'공유 저장 중'});
      const controller=new AbortController();timeout=setTimeout(()=>controller.abort(),runtimeOptions.saveMs);
      let response;
      try{
        response=await tripRepository.saveDocument(normalized,publishedRevision,note,controller.signal);
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
          if(remoteState)pendingRemoteState={row:remoteRow,state:remoteState};
          throw new Error('저장 시간이 초과되었습니다. 초안은 유지됩니다. 연결을 확인한 뒤 다시 저장해 주세요.');
        }
      }
      const {data,error}=response;
      if(error)throw error;
      applyStatePreservingInputs(normalized);setPublishedBaseline({revision:Number(data?.revision)||publishedRevision+1,updated_at:data?.updated_at||new Date().toISOString()},normalized);pendingDraft=false;await clearDraftRecord();updateDirtyState();return data||{saved:true};
    }catch(error){failure=error;}
    finally{clearTimeout(timeout);saveInFlight=false;setOperationBusy(false);}
    if(isRevisionConflict(failure))return resolveSaveConflict(normalized,note);
    console.error(failure);await flushDraftPersistence();
    setStatus(failure?.message||'저장할 수 없습니다. 초안은 유지됩니다.');return false;
  }

  async function saveAndFinish(note='수동 저장'){const state=captureState(),wasEditing=body.classList.contains('editing');setEditingUI(false);const saved=await persistState(state,{note});if(!saved){const message=$('#status').textContent;updateDirtyState();if(wasEditing)setEditingUI(true);setStatus(message);return false;}initializeHistory();updateDirtyState();resetInactivityTimer();setStatus(OFFLINE_MODE?'오프라인 작업본 생성 중':'공유 저장 완료');if(OFFLINE_MODE)await exportOfflineHtml(lastSavedState);return true;}
  async function requestFinishEditing(){clearTimeout(historyTimer);recordHistory();if(!isDirty()){setEditingUI(false);resetInactivityTimer();return;}setEditingUI(false);const choice=await showChoice({title:'편집을 완료할까요?',message:OFFLINE_MODE?'저장하면 수정된 오프라인 작업본을 새 파일로 내려받습니다.':'저장해야 공개 링크에 변경 내용이 반영됩니다.',input:OFFLINE_MODE?null:{label:'버전 메모 (선택)','placeholder':'예: 라스베이거스 일정 확정'},choices:[{label:'저장하고 종료',value:'save',className:'action-primary'},{label:'계속 편집',value:'continue'},{label:'변경사항 폐기',value:'discard',className:'action-danger'}]});if(choice==='save')await saveAndFinish(dialogs.inputValue()||'편집 완료');else if(choice==='continue'){setEditingUI(true);resetInactivityTimer();}else if(choice==='discard')discardDraft();}
  async function beginEditing(){if(!OFFLINE_MODE&&!pendingDraft){try{const published=await fetchPublishedState();if(published?.content?.html){const state=normalizeState(migratePublishedState(published.content));applyState(state);setPublishedBaseline(published,state);}}catch(error){if(blockUnsupportedDocument(error))return;console.warn(error);setStatus('최신 저장본 확인 실패 · 현재 화면에서 편집합니다.');}}setEditingUI(true);initializeHistory();resetInactivityTimer();setStatus(pendingDraft?'편집 중 · 저장되지 않음':'편집 모드');}
  function requestAuthentication(purpose){authPurpose=purpose;$('#authTitle').textContent=purpose==='edit'?'편집자 확인':purpose==='versions'?'버전 관리자 확인':purpose==='import'?'편집본 불러오기 권한 확인':purpose==='ledger-settings'?'가계부 설정 권한 확인':purpose==='checklist'?'체크리스트 편집자 확인':purpose==='ledger'?'가계부 편집자 확인':'저장 권한 확인';$('#authError').textContent='';$('#editorPassword').value='';showDialog($('#authDialog'));$('#editorPassword').focus();}
  async function runPurpose(purpose){
    if(documentWriteBlock&&purpose!=='versions'){pendingAuthAction=null;pendingAuthCancel?.();pendingAuthCancel=null;setStatus(documentWriteBlock);return;}
    const cancel=()=>{const action=pendingAuthCancel;pendingAuthAction=null;pendingAuthCancel=null;if(action)action();};
    if(body.classList.contains('previewing')&&purpose!=='versions'){cancel();setStatus('미리보기를 닫은 뒤 편집해 주세요.');return;}
    if(deferredDraftRecovery&&['edit','ledger','ledger-settings','import','save'].includes(purpose)){
      await recoverOnlineDraft();
      if(deferredDraftRecovery){cancel();return;}
    }
    resetInactivityTimer();if(purpose==='edit')await beginEditing();if(purpose==='versions')await openVersions();if(purpose==='save')await confirmSave();if(purpose==='ledger-settings')openLedgerSettings();if((purpose==='ledger'||purpose==='checklist'||purpose==='import')&&pendingAuthAction){const action=pendingAuthAction;pendingAuthAction=null;pendingAuthCancel=null;await action();}
  }
  async function requireEditor(purpose,action=null,cancelAction=null){if(action)pendingAuthAction=action;if(cancelAction)pendingAuthCancel=cancelAction;if(OFFLINE_MODE){await runPurpose(purpose);return;}if(!client){pendingAuthAction=null;const cancel=pendingAuthCancel;pendingAuthCancel=null;if(cancel)cancel();await showChoice({title:'편집할 수 없습니다.',message:'잠시 후 다시 시도해 주세요.',choices:[{label:'확인',value:'ok',className:'action-primary'}]});return;}if(await getEditorSession()){await runPurpose(purpose);return;}requestAuthentication(purpose);}
