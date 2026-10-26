async function showInactivityWarning(){dialogs.startNoticeCountdown();const dirty=isDirty();const choice=await showChoice({title:'자동 로그아웃 예정',message:dirty?'자동 로그아웃 후에도 초안은 이 브라우저에 보관됩니다.':'1분 안에 선택하지 않으면 자동 로그아웃합니다.',countdown:true,choices:dirty?[{label:'저장 후 로그아웃',value:'save',className:'action-primary'},{label:'계속 사용',value:'continue'},{label:'폐기 후 로그아웃',value:'discard',className:'action-danger'}]:[{label:'계속 사용',value:'continue',className:'action-primary'},{label:'로그아웃',value:'logout',className:'action-danger'}]});clearSessionTimers();if(choice==='save'){if(await saveAndFinish('자동 로그아웃 전 저장')){await signOutEditor();setStatus('변경사항을 저장하고 로그아웃했습니다.');}else resetInactivityTimer();}else if(choice==='continue')resetInactivityTimer();else if(choice==='discard')await discardAndLogout();else if(choice==='logout')await logoutPreservingDraft('로그아웃했습니다.');}

  function closeEditorDialogs(){invalidateVersionRequest();closeScheduleTimeDialog();['checklistDialog','ledgerSettingsDialog','categoryDialog','expenseDialog','mapDialog','photoEditDialog','importDialog','exportDialog','versionDialog','versionCompareDialog','photoViewer'].forEach(id=>{const dialog=$('#'+id);if(dialog)dialog.hidden=true;});editingCategoryId=null;editingExpenseId=null;activeScheduleRow=null;activePhotoFigure=null;selectedVersion=null;pendingImport=null;}
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
