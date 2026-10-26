  function closeNotice(result){const field=$('#noticeField');noticeInputValue=!field.hidden?$('#noticeInput').value.trim():'';$('#noticeDialog').hidden=true;$('#sessionCountdown').hidden=true;field.hidden=true;clearInterval(countdownTimer);const resolve=noticeResolver;noticeResolver=null;if(resolve)resolve(result);}
  function showChoice({title,message,choices,countdown=false,input=null}){if(noticeResolver)closeNotice('replaced');noticeInputValue='';$('#noticeTitle').textContent=title;$('#noticeMessage').textContent=message;const field=$('#noticeField');field.hidden=!input;if(input){$('#noticeFieldLabel').textContent=input.label||'메모';$('#noticeInput').value=input.value||'';$('#noticeInput').placeholder=input.placeholder||'';}const actions=$('#noticeActions');actions.innerHTML='';choices.forEach(choice=>{const b=document.createElement('button');b.type='button';b.textContent=choice.label;b.className=choice.className||'action-muted';b.onclick=()=>closeNotice(choice.value);actions.appendChild(b);});$('#sessionCountdown').hidden=!countdown;showDialog($('#noticeDialog'));if(input)setTimeout(()=>$('#noticeInput').focus(),0);return new Promise(resolve=>noticeResolver=resolve);}
  function focusableIn(dialog){return $$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])').filter(element=>dialog.contains(element)&&!element.hidden&&element.getClientRects().length);}
  function setFieldError(id,message=''){const input=$('#'+id),error=$('#'+id+'Error');input.setAttribute('aria-invalid',message?'true':'false');error.textContent=message;error.hidden=!message;}
  function rememberDialogOrigin(dialog){
    const element=document.activeElement;
    const action=['data-edit-expense','data-category-edit','data-media','data-edit-photo'].find(name=>element?.hasAttribute(name));
    const scope=element?.closest('[role="dialog"],[data-row-id],[data-photo-id]');
    const scopeSelector=scope?.id?'#'+CSS.escape(scope.id):scope?.hasAttribute('data-photo-id')?'[data-photo-id="'+CSS.escape(scope.dataset.photoId)+'"]':scope?.hasAttribute('data-row-id')?'[data-row-id="'+CSS.escape(scope.dataset.rowId)+'"]':'';
    const selector=element?.id?'#'+CSS.escape(element.id):action?scopeSelector+' ['+action+'="'+CSS.escape(element.getAttribute(action))+'"]':null;
    dialogFocusOrigins.set(dialog,{element,selector});
  }
  function showDialog(dialog){openDialogStack.filter(item=>item.hidden).reverse().forEach(registerDialogState);if(dialog.hidden)rememberDialogOrigin(dialog);dialog.hidden=false;registerDialogState(dialog);}
  function closeTopDialog(dialog){const closeId={checklistDialog:'checklistCancel',authDialog:'authCancel',versionDialog:'closeVersionsBtn',versionCompareDialog:'versionCompareClose',categoryDialog:'categoryCancel',ledgerSettingsDialog:'ledgerSettingsClose',expenseDialog:'expenseEditCancel',scheduleTimeDialog:'scheduleTimeCancel',mapDialog:'mapCancel',photoEditDialog:'photoEditCancel',importDialog:'importCancel',exportDialog:'exportCancel',photoViewer:'photoViewerClose',timetableDetail:'timetableDetailClose'}[dialog.id];if(dialog.id==='noticeDialog'){closeNotice($('#sessionCountdown').hidden?'cancel':'continue');return;}if(closeId)$('#'+closeId)?.click();}
  function registerDialogState(dialog){
    if(!dialog.hidden){if(!openDialogStack.includes(dialog)){if(!dialogFocusOrigins.has(dialog))rememberDialogOrigin(dialog);openDialogStack.push(dialog);}body.classList.add('modal-open');requestAnimationFrame(()=>{if(!dialog.hidden&&openDialogStack.at(-1)===dialog&&!dialog.contains(document.activeElement)){const focusable=focusableIn(dialog);(focusable[0]||dialog).focus();}});return;}
    const index=openDialogStack.lastIndexOf(dialog);if(index<0)return;const wasTop=index===openDialogStack.length-1;openDialogStack.splice(index,1);body.classList.toggle('modal-open',openDialogStack.length>0);
    const saved=dialogFocusOrigins.get(dialog);dialogFocusOrigins.delete(dialog);if(!wasTop)return;
    const next=openDialogStack.at(-1),origin=saved?.element?.isConnected?saved.element:saved?.selector?$(saved.selector):null;
    if(origin instanceof HTMLElement&&origin.getClientRects().length&&(!next||next.contains(origin)))origin.focus();
    else if(next){const focusable=focusableIn(next);(focusable[0]||next).focus();}
  }
  function initializeDialogAccessibility(){
    const dialogs=$$('[role="dialog"]');dialogs.forEach(dialog=>{if(!dialog.hasAttribute('tabindex'))dialog.tabIndex=-1;});
    const observer=new MutationObserver(records=>records.forEach(record=>registerDialogState(record.target)));dialogs.forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['hidden']}));
    document.addEventListener('keydown',event=>{const dialog=openDialogStack.at(-1);if(!dialog)return;if(event.key==='Escape'){event.preventDefault();closeTopDialog(dialog);return;}if(event.key!=='Tab')return;const focusable=focusableIn(dialog);if(!focusable.length){event.preventDefault();dialog.focus();return;}const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}},true);
  }
  function clearSessionTimers(){clearTimeout(warningTimer);clearTimeout(logoutTimer);clearInterval(countdownTimer);}
  function scheduleSessionTimers(at){if(OFFLINE_MODE)return;clearSessionTimers();const elapsed=Math.max(0,Date.now()-at);warningTimer=setTimeout(showInactivityWarning,Math.max(0,WARNING_MS-elapsed));logoutTimer=setTimeout(()=>logoutPreservingDraft('30분 동안 활동이 없어 자동 로그아웃되었습니다.'),Math.max(0,SESSION_MS-elapsed));}
  function editorEmailMatches(email){return String(email||'').trim().toLowerCase()===String(EDITOR_EMAIL||'').trim().toLowerCase();}
  function setEditorSession(session){editorSession=editorEmailMatches(session?.user?.email)?session:null;body.classList.toggle('authenticated',Boolean(editorSession)&&!OFFLINE_MODE);if(!editorSession){invalidateVersionRequest();clearSessionTimers();}return editorSession;}
  function acceptSharedActivity(at){if(!editorSession||!Number.isFinite(at)||Date.now()-at>=SESSION_MS)return;if(!$('#noticeDialog').hidden&&!$('#sessionCountdown').hidden)closeNotice('continue');scheduleSessionTimers(at);}
  function resetInactivityTimer(){if(OFFLINE_MODE||!editorSession)return;const now=Date.now();try{localStorage.setItem(SESSION_ACTIVITY_KEY,String(now));}catch(error){console.warn(error);}scheduleSessionTimers(now);if(now-lastActivityBroadcast>1000){sessionChannel?.postMessage({type:'activity',at:now});lastActivityBroadcast=now;}}
  async function getEditorSession(){if(OFFLINE_MODE){setEditorSession({offline:true,user:{email:EDITOR_EMAIL}});return editorSession;}if(!client)return null;const {data:{session}}=await client.auth.getSession();setEditorSession(session);if(!editorSession){try{localStorage.removeItem(SESSION_ACTIVITY_KEY);}catch(_){}return null;}let stored=0;try{stored=Number(localStorage.getItem(SESSION_ACTIVITY_KEY)||0);}catch(_){}if(stored&&Date.now()-stored>=SESSION_MS){await logoutPreservingDraft('편집 세션이 만료되어 로그아웃했습니다.');return null;}const at=stored||Date.now();try{localStorage.setItem(SESSION_ACTIVITY_KEY,String(at));}catch(_){}scheduleSessionTimers(at);return editorSession;}
  async function showInactivityWarning(){let seconds=60;const countdown=$('#sessionCountdown');countdown.textContent=seconds+'초 후 자동 로그아웃됩니다.';countdownTimer=setInterval(()=>{seconds--;countdown.textContent=Math.max(0,seconds)+'초 후 자동 로그아웃됩니다.';},1000);const dirty=isDirty();const choice=await showChoice({title:'자동 로그아웃 예정',message:dirty?'자동 로그아웃 후에도 초안은 이 브라우저에 보관됩니다.':'1분 안에 선택하지 않으면 자동 로그아웃합니다.',countdown:true,choices:dirty?[{label:'저장 후 로그아웃',value:'save',className:'action-primary'},{label:'계속 사용',value:'continue'},{label:'폐기 후 로그아웃',value:'discard',className:'action-danger'}]:[{label:'계속 사용',value:'continue',className:'action-primary'},{label:'로그아웃',value:'logout',className:'action-danger'}]});clearSessionTimers();if(choice==='save'){if(await saveAndFinish('자동 로그아웃 전 저장')){await signOutEditor();setStatus('변경사항을 저장하고 로그아웃했습니다.');}else resetInactivityTimer();}else if(choice==='continue')resetInactivityTimer();else if(choice==='discard')await discardAndLogout();else if(choice==='logout')await logoutPreservingDraft('로그아웃했습니다.');}
  async function signOutEditor({broadcast=true}={}){if(OFFLINE_MODE)return;invalidateVersionRequest();clearSessionTimers();signingOut=true;try{localStorage.removeItem(SESSION_ACTIVITY_KEY);}catch(_){}if(broadcast)sessionChannel?.postMessage({type:'signout'});try{if(client)await client.auth.signOut({scope:'local'});}catch(error){console.warn('서버 로그아웃 요청에 실패했지만 이 브라우저 세션은 종료합니다.',error);}finally{setEditorSession(null);signingOut=false;}}
  function closeEditorDialogs(){invalidateVersionRequest();closeScheduleTimeDialog();['checklistDialog','ledgerSettingsDialog','categoryDialog','expenseDialog','mapDialog','photoEditDialog','importDialog','exportDialog','versionDialog','versionCompareDialog','photoViewer'].forEach(id=>{const dialog=$('#'+id);if(dialog)dialog.hidden=true;});editingCategoryId=null;editingExpenseId=null;activeScheduleRow=null;activePhotoFigure=null;selectedVersion=null;pendingImport=null;}
  async function handleExternalSignOut(message='편집 세션이 다른 탭에서 종료되었습니다.') {
    invalidateVersionRequest();
    const hadDraft=isDirty()||deferredDraftRecovery;
    if(hadDraft){
      await flushDraftPersistence();
      // The shared view no longer contains this draft. Require recovery before
      // another edit, and retain the guard across duplicate sign-out events.
      deferredDraftRecovery=true;
    }
    if(previewReturnState)closePreview();
    if(lastSavedState)applyState(lastSavedState);
    initializeHistory();setEditingUI(false,{preserveDraft:true});closeEditorDialogs();closeNotice('signed-out');setEditorSession(null);
    setStatus(hadDraft?message+($('#draftStorageWarning')&&!$('#draftStorageWarning').hidden?' 초안 보관에 실패했습니다. 새로고침 전에 로그인해 저장하거나 내보내세요.':' 초안은 이 브라우저에 보관했습니다.'):message);
  }
  async function logoutPreservingDraft(message){
    clearSessionTimers();
    await handleExternalSignOut(message);
    await signOutEditor();
  }
  async function requestManualLogout(){if(!editorSession||OFFLINE_MODE)return;if(previewReturnState)closePreview();if(isDirty()){const choice=await showChoice({title:'로그아웃할까요?',message:'저장하지 않은 변경사항이 있습니다.',choices:[{label:'계속 사용',value:'continue'},{label:'폐기 후 로그아웃',value:'discard',className:'action-danger'},{label:'저장 후 로그아웃',value:'save',className:'action-primary'}]});if(choice!=='save'&&choice!=='discard')return;if(choice==='save'){if(!await saveAndFinish('로그아웃 전 저장'))return;}else{if(!await clearDraftRecord())return;if(lastSavedState)applyState(lastSavedState);}}setEditingUI(false);closeEditorDialogs();await signOutEditor();setStatus('편집자 로그아웃 완료');}
  async function discardDraft(message='수정 내용을 폐기했습니다.'){if(!await clearDraftRecord())return false;if(previewReturnState)closePreview();if(lastSavedState)applyState(lastSavedState);initializeHistory();setEditingUI(false);closeEditorDialogs();resetInactivityTimer();setStatus(message);return true;}
  async function discardAndLogout(message='수정 내용을 폐기하고 로그아웃했습니다.'){if(!await discardDraft(message)){resetInactivityTimer();return false;}closeNotice('timeout');await signOutEditor();setStatus(message);return true;}
