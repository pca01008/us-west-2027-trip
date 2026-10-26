  async function recoverOnlineDraft() {
    const record=await readDraftRecord();
    if(!record?.dirty||record.tripId!==TRIP_ID||!record.state?.html){deferredDraftRecovery=false;return;}
    const incoming=normalizeState(migratePublishedState(record.state));
    if(lastSavedState&&fingerprint(incoming)===fingerprint(lastSavedState)){pendingDraft=false;await clearDraftRecord();return;}
    if(!await getEditorSession()){
      deferredDraftRecovery=true;
      setStatus('초안을 보관했습니다 · 로그인 후 복구할 수 있습니다.');
      return;
    }
    const serverChanged=Number(record.baseRevision||0)!==publishedRevision;
    const savedAt=record.savedAt?new Date(record.savedAt).toLocaleString('ko-KR'):'이전 접속';
    const choice=await showChoice({title:'저장하지 않은 초안을 찾았습니다.',message:savedAt+'에 이 브라우저에 보관한 초안입니다.'+(serverChanged?' 그 뒤 공유 저장본이 변경되어 저장할 때 차이를 다시 확인합니다.':''),choices:[{label:'초안 삭제',value:'discard',className:'action-danger'},{label:'초안 복구',value:'restore',className:'action-primary'}]});
    if(choice==='discard'){
      pendingDraft=false;
      if(lastSavedState){applyState(lastSavedState);lastSavedState=clone(normalizeState(captureState()));}
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
    const latestState=clone(lastSavedState),latestRow={revision:publishedRevision,updated_at:publishedUpdatedAt,content:latestState};
    // A legacy draft without a baseline must not adopt a newer revision through
    // a checklist patch. Keep that uncertainty across subsequent draft writes.
    draftBaselineUnknown=serverChanged&&!record.baseState?.html;
    lastSavedState=record.baseState?.html?normalizeState(migratePublishedState(record.baseState)):latestState;
    publishedRevision=Math.max(0,Number(record.baseRevision)||0);publishedUpdatedAt=String(record.baseUpdatedAt||'');
    pendingRemoteState=serverChanged?{row:latestRow,state:latestState}:null;
    applyState(incoming);initializeHistory();updateDirtyState();setStatus('초안 복구됨 · 저장되지 않음');
  }

  async function refreshPublishedState(reason='refresh') {
    if(OFFLINE_MODE||!client||!navigator.onLine)return false;
    try{
      const row=await fetchPublishedState();if(!row?.content?.html)return false;
      const revision=Math.max(0,Number(row.revision)||0),state=normalizeState(migratePublishedState(row.content));
      if(body.classList.contains('editing')||pendingDraft||body.classList.contains('previewing')||checklistSaving||pendingChecks.size||!$('#checklistDialog').hidden){
        if(revision!==publishedRevision){pendingRemoteState={row,state};setStatus('새 공유 저장본이 있습니다 · 저장 시 비교합니다.');}
        return true;
      }
      if(revision!==publishedRevision||fingerprint(state)!==fingerprint(lastSavedState)){applyStatePreservingInputs(state);setPublishedBaseline(row,state);initializeHistory();setStatus(reason==='reconnect'?'연결 복구 · 최신 저장본 반영':'최신 저장본을 반영했습니다.');}
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
        lastSavedState=normalizeState(record.dirty&&record.baseState?.html?migratePublishedState(record.baseState):restored);
        applyState(restored);
        setStatus(record.dirty?'저장하지 않은 오프라인 초안을 복구했습니다.':'오프라인 작업본');
      }else{applyState(embeddedState);lastSavedState=clone(embeddedState);}
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
    if(!lastSavedState)lastSavedState=normalizeState(captureState());
    initializeHistory();updateDirtyState();if(cacheStatus)setStatus(cacheStatus);await recoverOnlineDraft();finishHydration();
    if(!client)return;
    client.channel('trip-document-'+TRIP_ID).on('postgres_changes',{event:'UPDATE',schema:'public',table:'trip_documents',filter:'trip_id=eq.'+TRIP_ID},payload=>{
      if(!payload.new?.content?.html)return;
      let remoteState;try{remoteState=normalizeState(migratePublishedState(payload.new.content));}catch(error){blockUnsupportedDocument(error);console.warn(error);return;}
      if(body.classList.contains('editing')||pendingDraft||body.classList.contains('previewing')||checklistSaving||pendingChecks.size||!$('#checklistDialog').hidden){pendingRemoteState={row:payload.new,state:remoteState};setStatus('새 공유 저장본이 있습니다 · 저장 시 비교합니다.');return;}
      applyStatePreservingInputs(remoteState);setPublishedBaseline(payload.new,remoteState);initializeHistory();setStatus('새 저장본을 반영했습니다.');
    }).subscribe(status=>{if(status==='SUBSCRIBED'&&loadedFromCache)void refreshPublishedState('reconnect');});
    await getEditorSession();
  }

  $('#editBtn').onclick=async()=>{if(body.classList.contains('editing')){await requestFinishEditing();return;}if(body.classList.contains('previewing'))closePreview();if($('.day-radio:checked')?.id==='prep'){await requireEditor('checklist',openChecklistEditor);return;}await requireEditor($('.day-radio:checked')?.id==='money'?'ledger-settings':'edit');};
  $('#logoutBtn').onclick=requestManualLogout;
  $('#undoBtn').onclick=()=>moveHistory(-1);$('#redoBtn').onclick=()=>moveHistory(1);$('#addTimeBtn').onclick=addTimeRow;$('#addCheckBtn').onclick=addCheckRow;$('#resetBtn').onclick=resetDraft;$('#saveBtn').onclick=()=>requireEditor('save');$('#exportMenuBtn').onclick=()=>$('#exportDialog').hidden=false;$('#exportBtn').onclick=()=>{$('#exportDialog').hidden=true;void exportStaticHtml();};$('#offlineExportBtn').onclick=()=>{$('#exportDialog').hidden=true;void exportOfflineHtml();};$('#exportCancel').onclick=()=>$('#exportDialog').hidden=true;$('#importBtn').onclick=chooseImportFile;$('#importFileInput').onchange=e=>{if(e.target.files[0])readImportFile(e.target.files[0]);};$('#versionsBtn').onclick=()=>requireEditor('versions');$('#tabsPrev').onclick=()=>scrollTabs(-1);$('#tabsNext').onclick=()=>scrollTabs(1);$('#closePreviewBtn').onclick=closePreview;$('#closeVersionsBtn').onclick=closeVersions;$('#versionCompareClose').onclick=()=>{invalidateVersionRequest();$('#versionCompareDialog').hidden=true;selectedVersion=null;};$('#versionCompareRestore').onclick=restoreSelectedVersion;
  $('#authCancel').onclick=()=>{$('#authDialog').hidden=true;const cancel=pendingAuthCancel;pendingAuthAction=null;pendingAuthCancel=null;if(cancel)cancel();};
  $('#authForm').onsubmit=async event=>{event.preventDefault();const submit=$('#authSubmit');if(submit.disabled)return;submit.disabled=true;$('#authError').textContent='';try{const {error}=await client.auth.signInWithPassword({email:EDITOR_EMAIL,password:$('#editorPassword').value});if(error){$('#authError').textContent=error.status>=500||error.name==='AuthRetryableFetchError'?'로그인 서버에 연결하지 못했습니다.':'비밀번호를 확인해 주세요.';return;}const session=await getEditorSession();if(!session){$('#authError').textContent='로그인 세션을 확인하지 못했습니다.';return;}$('#authDialog').hidden=true;await runPurpose(authPurpose);}catch(error){console.error(error);$('#authError').textContent='로그인 서버에 연결하지 못했습니다.';}finally{submit.disabled=false;}};
  $('#categoryCancel').onclick=()=>$('#categoryDialog').hidden=true;$('#categorySave').onclick=saveCategory;
  $('#ledgerSettingsClose').onclick=()=>{const rateInput=$('#settingsExchangeRate');let rate;try{rate=parseLedgerRate(rateInput.value);}catch(_){rate=NaN;}if(!Number.isFinite(rate)||rate<=0){rateInput.value=String(exchangeRate);setStatus('올바른 환율을 입력해 주세요.');return;}const changed=rate!==exchangeRate;if(changed){exchangeRate=rate;exchangeRateUpdated=new Date().toISOString();}$('#ledgerSettingsDialog').hidden=true;if(changed){renderLedger();finishMutation();setStatus('가계부 설정 변경됨 · 저장되지 않음');}else updateDirtyState();resetInactivityTimer();};
  $('#expenseEditCancel').onclick=()=>{$('#expenseDialog').hidden=true;editingExpenseId=null;expenseEditInput=emptyExpenseInput();};$('#expenseEditSave').onclick=saveExpenseChanges;$('#mapCancel').onclick=()=>$('#mapDialog').hidden=true;$('#mapSave').onclick=saveMap;$('#photoEditCancel').onclick=()=>{$('#photoEditDialog').hidden=true;activePhotoFigure=null;};$('#photoEditSave').onclick=savePhotoMetadata;$('#importCancel').onclick=()=>{$('#importDialog').hidden=true;pendingImport=null;};$('#importApply').onclick=applyImportedDraft;$('#photoViewerClose').onclick=()=>$('#photoViewer').hidden=true;$('#photoInput').onchange=e=>{void attachPhotos(Array.from(e.target.files||[]));e.target.value='';};$('#cancelOperationBtn').onclick=cancelCurrentOperation;
  document.addEventListener('click',event=>{
    if(operationBusy&&!event.target.closest('#cancelOperationBtn'))return;
    if(event.target.closest('#expenseCsvExport')){exportExpensesCsv();return;}
    if(event.target.closest('#addCategoryBtn,#settingsAddCategory')){requireEditor('ledger',()=>openCategoryDialog());return;}
    const media=event.target.closest('[data-media]');if(media&&body.classList.contains('editing')){activeScheduleRow=media.closest('.timeline-row');if(media.dataset.media==='time')openScheduleTimeDialog(activeScheduleRow);else if(media.dataset.media==='photo')$('#photoInput').click();else if(media.dataset.media==='map')openMapDialog(activeScheduleRow);else addScheduleWarning(activeScheduleRow);return;}
    const photoMove=event.target.closest('[data-move-photo]');if(photoMove&&!photoMove.disabled){movePhoto(photoMove.closest('.schedule-photo'),Number(photoMove.dataset.movePhoto));return;}
    const photoEdit=event.target.closest('[data-edit-photo]');if(photoEdit&&body.classList.contains('editing')){openPhotoEditDialog(photoEdit.closest('.schedule-photo'));return;}
    const photo=event.target.closest('.schedule-photo img');if(photo&&!photo.closest('.map-capture')&&!body.classList.contains('editing')){$('#photoViewerImage').src=photo.dataset.fullUrl||photo.src;$('#photoViewerImage').alt=photo.alt||'일정 사진';$('#photoViewer').hidden=false;return;}
    if(event.target.closest('[data-delete-photo]')&&body.classList.contains('editing')){const figure=event.target.closest('.schedule-photo'),gallery=figure?.parentElement;figure?.remove();if(gallery&&!gallery.querySelector('.schedule-photo'))gallery.remove();else updatePhotoMoveButtons(gallery);recordHistory();return;}
    if(event.target.classList.contains('schedule-map-delete')&&body.classList.contains('editing')){event.target.closest('.schedule-map')?.remove();recordHistory();return;}
    const rowMove=event.target.closest('[data-move-row]');if(rowMove&&!rowMove.disabled){moveScheduleRow(rowMove.closest('.timeline-row'),Number(rowMove.dataset.moveRow));return;}
    if(event.target.closest('[data-delete-row]')&&body.classList.contains('editing')){event.target.closest('.timeline-row')?.remove();updateScheduleMoveButtons();recordHistory();return;}
    if(event.target.classList.contains('check-delete')&&body.classList.contains('editing')){event.target.closest('label')?.remove();updateChecklistMoveButtons();recordHistory();return;}
    const checkMove=event.target.closest('[data-move-check]');if(checkMove&&!checkMove.disabled){moveCheck(checkMove.dataset.moveCheck,Number(checkMove.dataset.moveDirection));return;}
    if(event.target.classList.contains('warning-delete')&&body.classList.contains('editing')){event.target.closest('.schedule-warning')?.remove();recordHistory();return;}
    const expenseId=event.target.dataset.removeExpense;if(expenseId){deleteExpense(expenseId);return;}
    const editExpenseId=event.target.closest('[data-edit-expense]')?.dataset.editExpense;if(editExpenseId){requestExpenseEdit(editExpenseId);return;}
    const moveButton=event.target.closest('[data-move-expense]');if(moveButton&&!moveButton.disabled){moveExpense(moveButton.dataset.moveExpense,Number(moveButton.dataset.moveDirection));return;}
    if(event.target.closest('#addExpense')){addExpense();return;}
    const editId=event.target.dataset.categoryEdit;if(editId){requireEditor('ledger',()=>openCategoryDialog(editId));return;}
    const deleteId=event.target.dataset.categoryDelete;if(deleteId){requireEditor('ledger',()=>deleteCategory(deleteId));return;}
    const icon=event.target.dataset.categoryIcon;if(icon){selectedCategoryIcon=icon;renderIconPicker();}
  });
  $('#scheduleTimeCancel').onclick=closeScheduleTimeDialog;$('#scheduleTimeSave').onclick=saveScheduleTime;
  initializeScheduleClocks();
  document.addEventListener('change',event=>{if(event.target.matches('.schedule-kind-select'))changeScheduleKind(event.target);});
  document.addEventListener('input',event=>{const row=event.target.closest('.timeline-row');if(row&&event.target.closest('h3,.chip'))updateScheduleKindControl(row);});
  $('#scheduleTimeDialog').addEventListener('input',updateScheduleTimePreview);
  $('#scheduleTimeMode').onchange=updateScheduleTimePreview;
  $('#scheduleTimeDialog').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&event.target.matches('input')){event.preventDefault();saveScheduleTime();}});
  document.addEventListener('keydown',event=>{const photo=event.target.closest?.('.schedule-photo img[role="button"]');if(photo&&!body.classList.contains('editing')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();photo.click();}});
  document.addEventListener('paste',event=>{const target=event.target.closest?.('[contenteditable="true"]');if(!target)return;event.preventDefault();const text=event.clipboardData?.getData('text/plain')||'';insertPlainText(target,text);});
  function refreshEditablePlaceholder(event){const element=event.target.closest?.('[contenteditable="true"][data-placeholder]');if(element)updateEditableEmpty(element);}
  document.addEventListener('compositionend',refreshEditablePlaceholder);
  document.addEventListener('input',event=>{refreshEditablePlaceholder(event);if(body.classList.contains('editing')&&event.target.closest('main')&&!event.target.closest('.add-expense')&&event.target.id!=='exchangeRate')queueHistory();});
  document.addEventListener('input',handleExpenseInput);
  document.addEventListener('compositionend',handleExpenseInput);
  document.addEventListener('change',async event=>{if(event.target.id==='settingsExchangeRate'||event.target.id==='exchangeRate'){const input=event.target,before=String(exchangeRate);await requireEditor('ledger',()=>updateExchangeRate(input),()=>{input.value=before;});return;}if(event.target.matches('.prepday .checklist input[type="checkbox"]')){await requestCheckToggle(event.target);return;}if(body.classList.contains('editing')&&event.target.closest('main')&&!event.target.closest('.add-expense')&&event.target.id!=='exchangeRate')recordHistory();if(event.target.matches('.day-radio')){const tabs=$('.tabs'),keepTabsPinned=Boolean(tabs&&tabsArePinned(tabs));cancelTabScrollRelease();if(keepTabsPinned)holdMainHeight();else releaseMainHeight();updateContextControls();revealSelectedTab();if(keepTabsPinned)requestAnimationFrame(()=>alignPageToTabs(tabs));}});
  $('.bottom-nav').addEventListener('click',event=>{
    const button=event.target.closest('[data-section]');if(!button||operationBusy)return;
    const id=button.dataset.section==='schedule'?lastScheduleDay:button.dataset.section,radio=document.getElementById(id);
    if(!radio||radio.checked)return;
    cancelTabScrollRelease();releaseMainHeight();radio.checked=true;updateContextControls();revealSelectedTab('auto');
    const content=$('#scheduleViewSwitch').hidden?$('main'):$('#scheduleViewSwitch');content.scrollIntoView({block:'start',behavior:'instant'});
  });
  // Native label activation focuses the hidden radio and scrolls to the header
  // before change fires. Activate it without moving focus off the visible tab.
  $('.tabs').addEventListener('click',event=>{
    const tab=event.target.closest('label[for]'),radio=tab?document.getElementById(tab.htmlFor):null;
    if(!radio?.matches('.day-radio'))return;
    event.preventDefault();tab.focus({preventScroll:true});
    if(!radio.checked)radio.click();
    else if(timetableActive)radio.dispatchEvent(new Event('change',{bubbles:true}));
  });
  $('.tabs').addEventListener('keydown',event=>{const current=event.target.closest('[role="tab"]');if(!current)return;const tabs=$$('.tabs [role="tab"]'),index=tabs.indexOf(current);let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else if(event.key==='Enter'||event.key===' '){event.preventDefault();current.click();return;}else return;event.preventDefault();tabs[next].click();tabs[next].focus({preventScroll:true});});
  $('.tabs').addEventListener('wheel',event=>{const tabs=event.currentTarget;if(tabs.scrollWidth<=tabs.clientWidth||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;event.preventDefault();tabs.scrollLeft+=event.deltaY;},{passive:false});
  ['pointerdown','keydown'].forEach(type=>document.addEventListener(type,()=>{if(editorSession&&$('#noticeDialog').hidden)resetInactivityTimer();},{passive:true}));
  sessionChannel?.addEventListener('message',event=>{if(event.data?.type==='activity')acceptSharedActivity(Number(event.data.at));if(event.data?.type==='signout'&&editorSession&&!signingOut)void handleExternalSignOut();});
  window.addEventListener('storage',event=>{if(event.key!==SESSION_ACTIVITY_KEY)return;if(event.newValue)acceptSharedActivity(Number(event.newValue));else if(editorSession&&!signingOut)void handleExternalSignOut();});
  window.addEventListener('online',()=>void refreshPublishedState('reconnect'));
  window.addEventListener('offline',()=>setStatus(pendingDraft?'오프라인 · 초안은 이 브라우저에 보관 중':'오프라인 · 저장된 화면 표시 중'));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshPublishedState('visible');else void flushDraftPersistence();});
  window.addEventListener('pagehide',()=>{void flushDraftPersistence();});
  window.addEventListener('beforeunload',event=>{if(!isDirty()&&!saveInFlight&&!pendingChecks.size&&!checklistEditorSaving&&!checklistEditorDirty())return;void flushDraftPersistence();event.preventDefault();event.returnValue='';});
  if(client)client.auth.onAuthStateChange((_event,session)=>{const wasAuthenticated=Boolean(editorSession),valid=editorEmailMatches(session?.user?.email)?session:null;if(valid){setEditorSession(valid);return;}setEditorSession(null);if(wasAuthenticated&&!signingOut)setTimeout(()=>void handleExternalSignOut('편집 세션이 종료되었습니다.'),0);});

  document.addEventListener('click',event=>{if((pendingChecks.size||checklistSaving)&&event.target.closest('.editor-bar')){event.preventDefault();event.stopImmediatePropagation();}},true);
  $('#checklistAdd').onclick=addChecklistItem;
  $('#checklistCancel').onclick=()=>{if(!checklistEditorSaving){$('#checklistDialog').hidden=true;syncChecklistControls();}};
  $('#checklistSave').onclick=()=>void saveChecklistEditor();
  $('#checklistEditorRows').addEventListener('input',event=>{const index=Number(event.target.dataset.checkIndex);if(event.target.matches('.checklist-text')&&checklistEditorItems[index])checklistEditorItems[index].text=event.target.value;resetInactivityTimer();});
  $('#checklistEditorRows').addEventListener('click',event=>{const button=event.target.closest('[data-check-action]');if(!button||button.disabled)return;const index=Number(button.dataset.index),action=button.dataset.checkAction;if(action==='delete')checklistEditorItems.splice(index,1);else{const next=index+(action==='up'?-1:1);[checklistEditorItems[index],checklistEditorItems[next]]=[checklistEditorItems[next],checklistEditorItems[index]];}renderChecklistEditor();const rows=$$('#checklistEditorRows .checklist-editor-row');rows[Math.min(index,rows.length-1)]?.querySelector('.checklist-text')?.focus();});
  document.addEventListener('click',event=>{const retry=event.target.closest('[data-retry-check]');if(!retry)return;const item=checkFeedback.get(retry.dataset.retryCheck);if(item)void authorizeCheck(retry.dataset.retryCheck,item.value);});
  initializeTimetable();initializeDialogAccessibility();selectInitialTab();decorateButtonIcons();decorateDates();decorateChecklist();renderLedger();moneyTemplateHtml=$('.moneyday').outerHTML;decorateScheduleRows();body.classList.add('viewing');setEditable(false);lastSavedState=normalizeState(captureState());updateContextControls();updateTripProgress();updateWorldClocks();setInterval(updateTripProgress,60*60*1000);setInterval(updateWorldClocks,60*1000);revealSelectedTab('auto');void hydrate().catch(error=>{blockUnsupportedDocument(error);console.error(error);setStatus('일정을 불러오지 못했습니다 · 현재 화면 유지');}).finally(finishHydration);
