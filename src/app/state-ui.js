  function captureState() {
    const main=$('main').cloneNode(true);
    main.querySelectorAll('[contenteditable]').forEach(el=>el.setAttribute('contenteditable','false'));
    main.querySelectorAll('.schedule-media-tools,.photo-actions,.row-actions,.photo-delete,.schedule-map-delete,.row-delete,.check-delete,.check-actions,.check-feedback,.warning-delete').forEach(el=>el.remove());
    main.querySelector('#ledgerMigrationNotice')?.remove();
    main.querySelectorAll('.add-expense .amount-hint').forEach(el=>{el.textContent='';el.classList.remove('amount-error');});
    main.querySelectorAll('.add-expense input').forEach(el=>{el.removeAttribute('value');el.removeAttribute('aria-invalid');});
    const rendered=main.querySelector('#expenses');if(rendered)rendered.innerHTML='';
    const manager=main.querySelector('#categoryManagerList');if(manager)manager.innerHTML='';
    const summary=main.querySelector('#categorySummary');if(summary)summary.innerHTML='';
    main.querySelectorAll('input[type="checkbox"]').forEach(input=>{input.removeAttribute('checked');input.removeAttribute('disabled');});
    return {schemaVersion:SCHEMA_VERSION,...currencyMetadata(),html:main.innerHTML,expenses:clone(expenses),categories:clone(categories),exchangeRate,exchangeRateUpdated,budgetKrw,checks:$$('main input[type="checkbox"]').map(input=>pendingChecks.get(input.closest('[data-check-id]')?.dataset.checkId)?.before??input.checked)};
  }
  function applyState(raw) {
    if(!raw?.html)return; const state=normalizeState(raw); applyingHistory=true;
    const pendingEntry=expenseAddPending?$$('.add-expense input,.add-expense select').map(input=>({id:input.id,value:input.value})):[];
    $('#timetableDetail').hidden=true;closeScheduleTimeDialog();
    $('main').innerHTML=state.html; expenses=clone(state.expenses);categories=clone(state.categories);exchangeRate=state.exchangeRate;exchangeRateUpdated=state.exchangeRateUpdated;budgetKrw=state.budgetKrw;
    decorateDates();decorateChecklist();decorateScheduleRows();renderLedger();
    pendingEntry.forEach(({id,value})=>{const input=$('#'+id);if(input&&(input.tagName!=='SELECT'||Array.from(input.options).some(option=>option.value===value)))input.value=value;});drawExpenseInput();
    if(Array.isArray(state.checks))$$('main input[type="checkbox"]').forEach((input,index)=>input.checked=Boolean(state.checks[index]));
    setEditable(body.classList.contains('editing'));updateContextControls();applyingHistory=false;renderCheckFeedback();
  }
  function fingerprint(state){return JSON.stringify(normalizeState(state||{}));}
  function isDirty(){return Boolean(lastSavedState&&fingerprint(previewReturnState||captureState())!==fingerprint(lastSavedState));}
  function updateDirtyState({preserveDraft=false}={}){const wasDirty=pendingDraft;pendingDraft=isDirty();$('#saveBtn').disabled=!pendingDraft;setStatus(body.classList.contains('editing')?(pendingDraft?'편집 중 · 저장되지 않음':'편집 모드'):(pendingDraft?'저장 대기 중':(OFFLINE_MODE?'오프라인 작업본':'보기 모드')));if(pendingDraft)queueDraftPersistence();else if(wasDirty&&!preserveDraft&&!body.classList.contains('hydrating'))clearCleanDraft();syncChecklistControls();}
  function setEditable(on){$$('main [contenteditable],.checklist label>span:not(.check-actions),.schedule-warning-text,main .day:not(.prepday):not(.moneyday) .day-head p').forEach(el=>el.contentEditable=on?'true':'false');$('#exchangeRate').disabled=true;$$('.check-actions,.time,.time [contenteditable]').forEach(el=>el.contentEditable='false');$$('.prepday [contenteditable]').forEach(el=>el.contentEditable='false');syncChecklistControls();if(!on)closeScheduleTimeDialog();}
  function recordHistory(){if(!body.classList.contains('editing')||applyingHistory)return;const next=captureState();if(historyIndex>=0&&fingerprint(history[historyIndex])===fingerprint(next))return;history=history.slice(0,historyIndex+1);history.push(clone(next));if(history.length>100)history.shift();historyIndex=history.length-1;updateHistoryControls();updateDirtyState();}
  function queueHistory(){updateDirtyState();if(pendingDraft)void flushDraftPersistence();clearTimeout(historyTimer);historyTimer=setTimeout(recordHistory,400);}
  function initializeHistory(){history=[clone(captureState())];historyIndex=0;updateHistoryControls();}
  function updateHistoryControls(){$('#undoBtn').disabled=historyIndex<=0;$('#redoBtn').disabled=historyIndex<0||historyIndex>=history.length-1;}
  function moveHistory(offset){const next=historyIndex+offset;if(next<0||next>=history.length)return;historyIndex=next;applyState(history[next]);updateHistoryControls();updateDirtyState();resetInactivityTimer();}
  function updateEditButton(){const button=$('#editBtn'),money=$('.day-radio:checked')?.id==='money',editing=body.classList.contains('editing'),icon=editing?'check':money?'settings':'edit',label=editing?'편집 완료':money?'가계부 설정':$('.day-radio:checked')?.id==='prep'?'목록 편집':'편집 시작';button.dataset.icon=icon;button.innerHTML=iconSvg(icon)+label;}
  function syncSelectedPanel(){const id=$('.day-radio:checked')?.id||'prep',selector=id==='prep'?'.prepday':id==='money'?'.moneyday':/^d\d+$/.test(id)?'.day'+id.slice(1):'.prepday';$$('main .panel.day').forEach(panel=>{const active=panel.matches(selector),panelId=panel.classList.contains('prepday')?'prep':panel.classList.contains('moneyday')?'money':'d'+(Array.from(panel.classList).find(name=>/^day\d+$/.test(name))||'day1').slice(3);panel.id='panel-'+panelId;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-'+panelId);panel.setAttribute('aria-hidden',String(!active));panel.classList.toggle('is-active',active);});$$('.tabs label[for]').forEach(label=>{const active=label.htmlFor===id;label.id='tab-'+label.htmlFor;label.setAttribute('role','tab');label.setAttribute('aria-controls','panel-'+label.htmlFor);label.setAttribute('aria-selected',String(active));label.tabIndex=active?0:-1;label.classList.toggle('is-active',active);});}
  function updateContextControls(){const id=$('.day-radio:checked')?.id||'';if(/^d\d+$/.test(id))lastScheduleDay=id;syncSelectedPanel();$$('.bottom-nav button').forEach(button=>{const active=button.dataset.section===(/^d\d+$/.test(id)?'schedule':id);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});$('#addTimeBtn').classList.toggle('hidden',!/^d\d+$/.test(id));$('#addCheckBtn').classList.add('hidden');updateEditButton();syncScheduleView();}
  function setEditingUI(on,options){body.classList.toggle('editing',on);body.classList.toggle('viewing',!on);setEditable(on);updateContextControls();updateDirtyState(options);}
