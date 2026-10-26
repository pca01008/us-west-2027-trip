  function decorateDates() {
    TRIP_DAYS.forEach((day,index)=>{
      const number=index+1,parts=configDateParts(day.date),head=$('.day'+number+' .day-head h2'),tab=$('label[for="d'+number+'"]');
      if(head) head.innerHTML=parts.month+'/'+parts.day+'<span>'+parts.weekday+' · DAY '+number+'</span>';
      if(tab) tab.innerHTML=parts.month+'/'+parts.day+'<span>'+parts.weekday.slice(0,1)+' · DAY '+number+'</span>';
    });
  }
  // Patch the latest published snapshot by stable checklist ID, never a local
  // document draft. The existing revision-checked RPC makes each patch atomic.
  function checklistItems(state) {
    const template=document.createElement('template');template.innerHTML=state.html;
    return Array.from(template.content.querySelectorAll('.prepday .checklist label')).map((label,index)=>({id:label.dataset.checkId,text:checkLabelText(label),important:label.dataset.checkImportant==='true',checked:Boolean(state.checks?.[index])}));
  }
  function checklistShape(items){return JSON.stringify(items.map(({id,text,important})=>({id,text,important:Boolean(important)})));}
  function patchCheck(state,id,value) {
    const next=clone(state),items=checklistItems(next),index=items.findIndex(item=>item.id===id);
    if(index<0)throw new Error('항목이 삭제되었습니다. 목록을 새로 확인해 주세요.');
    if(items[index].checked===value)return next;
    const [item]=items.splice(index,1);item.checked=value;
    const firstIncomplete=items.findIndex(entry=>!entry.checked);
    items.splice(firstIncomplete<0?items.length:firstIncomplete,0,item);
    return patchChecklist(next,items);
  }
  function patchChecklist(state,items) {
    const next=clone(state),template=document.createElement('template');template.innerHTML=next.html;
    const list=template.content.querySelector('.prepday .checklist');
    list.querySelectorAll('label,.check-feedback').forEach(el=>el.remove());
    items.forEach(item=>{const label=document.createElement('label');label.dataset.checkId=item.id;if(item.important)label.dataset.checkImportant='true';const input=document.createElement('input');input.type='checkbox';const span=document.createElement('span');span.contentEditable='false';span.textContent=item.text;label.append(input,span);list.append(label);});
    next.html=template.innerHTML;next.checks=items.map(item=>Boolean(item.checked));return next;
  }
  function syncChecklistControls() {
    const busy=checklistSaving||pendingChecks.size>0;
    $$('.prepday .checklist input[type="checkbox"]').forEach(input=>{input.disabled=body.classList.contains('editing')||body.classList.contains('previewing')||operationBusy||checklistAuthPending||pendingChecks.has(input.closest('label').dataset.checkId)||!$('#checklistDialog').hidden;});
    if(busy){$('#editBtn').disabled=true;$('#saveBtn').disabled=true;}
    else $('#editBtn').disabled=false;
    if(body.classList.contains('previewing'))$('#saveBtn').disabled=true;
  }
  function renderCheckFeedback() {
    $$('.check-feedback').forEach(el=>el.remove());
    $$('.prepday .checklist label').forEach(label=>{
      const id=label.dataset.checkId,pending=pendingChecks.get(id),feedback=checkFeedback.get(id);
      if(pending)label.querySelector('input').checked=pending.value;
      if(!pending&&!feedback)return;
      const line=document.createElement('div');line.className='check-feedback';line.setAttribute('role','status');line.setAttribute('aria-live','polite');
      line.textContent=pending?'저장 중…':feedback.message;
      if(!pending&&feedback.error){line.dataset.error='true';const retry=document.createElement('button');retry.type='button';retry.dataset.retryCheck=id;retry.textContent='재시도';line.append(retry);}
      label.after(line);
    });
    syncChecklistControls();
  }
  function applyStatePreservingInputs(state) {
    // Preserve unsubmitted expense entry and keyboard focus across rendering.
    const preservedExpenseInput=clone(expenseInput);
    const fields=$$('.add-expense input,.add-expense select').map(input=>({id:input.id,value:input.value}));
    const active=document.activeElement,wasInMain=Boolean(active?.closest('main')),focusId=active?.id,checkId=active?.closest('.prepday [data-check-id]')?.dataset.checkId;
    const selection=active instanceof HTMLInputElement?[active.selectionStart,active.selectionEnd]:null;
    applyState(state);
    fields.forEach(({id,value})=>{const input=document.getElementById(id);if(input&&(input.tagName!=='SELECT'||Array.from(input.options).some(option=>option.value===value)))input.value=value;});
    expenseInput=preservedExpenseInput;drawExpenseInput();
    const focus=checkId?$$('.prepday [data-check-id]').find(label=>label.dataset.checkId===checkId)?.querySelector('input'):focusId?document.getElementById(focusId):null;
    if(focus&&wasInMain&&!focus.disabled){focus.focus({preventScroll:true});if(selection&&selection[0]!==null)focus.setSelectionRange(...selection);}
  }
  async function commitChecklistPatch(transform,note,isApplied) {
    if(documentWriteBlock)throw new Error(documentWriteBlock);
    if(saveInFlight||operationBusy)throw new Error('다른 저장이 끝난 뒤 다시 시도해 주세요.');
    checklistSaving=true;syncChecklistControls();
    try {
      for(let attempt=0;attempt<3;attempt++) {
        const row=OFFLINE_MODE?null:await fetchPublishedState();
        if(!OFFLINE_MODE&&!row)throw new Error('공유 저장본을 확인하지 못했습니다.');
        const remote=row?.content?.html?normalizeState(migratePublishedState(row.content)):clone(lastSavedState);
        let saved=normalizeState(transform(remote,true));
        let result={revision:publishedRevision,updated_at:publishedUpdatedAt};
        if(!OFFLINE_MODE&&fingerprint(saved)===fingerprint(remote)){
          transform(remote,'verified');saved=remote;result=row;
        }else if(!OFFLINE_MODE){
          const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),runtimeOptions.saveMs);
          let response,failure;
          try{response=await tripRepository.saveDocument(saved,Number(row.revision)||0,note,controller.signal);}
          catch(error){failure=error;}finally{clearTimeout(timeout);}
          if(response?.error&&isRevisionConflict(response.error)){if(attempt<2)continue;throw response.error;}
          const uncertain=controller.signal.aborted||failure||response?.status>=500||response?.status===408||response?.status===0||(!response?.data&&!response?.error);
          if(uncertain){
            // Read once after an ambiguous write; never automatically resend it.
            let latest;try{latest=await fetchPublishedState();}catch(_){}
            const latestState=latest?.content?.html?normalizeState(migratePublishedState(latest.content)):null;
            if(!latestState||!isApplied(latestState)){
              if(latestState)pendingRemoteState={row:latest,state:latestState};
              const error=new Error('저장 결과 확인 필요 · 연결 후 재시도해 주세요.');error.uncertain=true;throw error;
            }
            // Refresh list completion flags from the verified snapshot, including
            // changes made after our commit. Keep unrelated local drafts private.
            transform(latestState,'verified');saved=latestState;result=latest;
          }else{
            if(response.error)throw response.error;
            result=response.data;
          }
        }
        // Transfer only this operation's result into the local draft and its
        // undo history. Unrelated local changes remain unpublished and dirty.
        const localBefore=captureState(),baseBefore=clone(lastSavedState);
        const nextLocal=transform(localBefore),nextBase=normalizeState(transform(baseBefore));
        if(OFFLINE_MODE){
          clearTimeout(draftWriteTimer);
          const dirty=fingerprint(nextLocal)!==fingerprint(nextBase);
          const ok=await writeDraftRecord({tripId:TRIP_ID,schemaVersion:SCHEMA_VERSION,state:nextLocal,baseState:nextBase,baseRevision:publishedRevision,baseUpdatedAt:publishedUpdatedAt,savedAt:new Date().toISOString(),dirty});
          if(!ok)throw new Error('브라우저에 저장하지 못했습니다. 다시 시도해 주세요.');
        }
        const persistedItems=checklistItems(nextLocal);pendingChecks.forEach((pending,id)=>{const item=persistedItems.find(item=>item.id===id);if(item)pending.before=item.checked;});
        const noOtherDraft=fingerprint(localBefore)===fingerprint(baseBefore)&&!body.classList.contains('editing');
        if(noOtherDraft&&!OFFLINE_MODE){
          applyStatePreservingInputs(saved);
          // captureState deliberately excludes optimistic values still in flight.
          lastSavedState=normalizeState(captureState());publishedRevision=Number(result.revision);publishedUpdatedAt=result.updated_at;pendingRemoteState=null;draftBaselineUnknown=false;
        }else{
          applyStatePreservingInputs(nextLocal);lastSavedState=nextBase;
          if(OFFLINE_MODE||(!draftBaselineUnknown&&fingerprint(nextBase)===fingerprint(saved))){publishedRevision=Number(result.revision);publishedUpdatedAt=result.updated_at;pendingRemoteState=null;}
          else pendingRemoteState={row:{...result,content:saved},state:saved};
        }
        history=history.map(state=>{try{return transform(state);}catch(_){return state;}});
        if(!OFFLINE_MODE)void writePublicCache(saved,{revision:Number(result.revision),updatedAt:result.updated_at});
        return saved;
      }
    }finally{checklistSaving=false;syncChecklistControls();}
  }
  async function authorizeCheck(id,value) {
    if(checklistAuthPending||pendingChecks.has(id))return;
    checklistAuthPending=true;syncChecklistControls();
    const release=()=>{checklistAuthPending=false;syncChecklistControls();};
    try{await requireEditor('checklist',()=>{release();queueCheck(id,value);},release);}catch(error){release();checkFeedback.set(id,{error:true,value,message:'저장 실패'});renderCheckFeedback();}
  }
  async function requestCheckToggle(input) {
    const id=input.closest('label').dataset.checkId,value=input.checked;
    input.checked=!value;
    if(body.classList.contains('editing')||body.classList.contains('previewing')||operationBusy)return;
    await authorizeCheck(id,value);
  }
  function queueCheck(id,value) {
    const input=$$('.prepday .checklist label').find(label=>label.dataset.checkId===id)?.querySelector('input');if(!input)return;
    pendingChecks.set(id,{before:input.checked,value});checkFeedback.delete(id);input.checked=value;renderCheckFeedback();
    checklistQueue=checklistQueue.then(async()=>{
      let saved;
      try{saved=await commitChecklistPatch(state=>patchCheck(state,id,value),'준비 체크 변경',state=>checklistItems(state).some(item=>item.id===id&&item.checked===value));checkFeedback.set(id,{message:OFFLINE_MODE?'이 브라우저에 저장됨':'저장됨'});}
      catch(error){checkFeedback.set(id,{error:true,value,message:error.uncertain||/항목이 삭제/.test(error.message||'')?error.message:'저장 실패'});}
      finally{
        const before=pendingChecks.get(id)?.before,restoreFocus=document.activeElement===document.body;pendingChecks.delete(id);
        const current=$$('.prepday .checklist label').find(label=>label.dataset.checkId===id)?.querySelector('input');if(current)current.checked=saved?value:before;
        updateDirtyState();renderCheckFeedback();if(restoreFocus&&current&&$('.day-radio:checked')?.id==='prep'&&$('#authDialog').hidden)current.focus({preventScroll:true});resetInactivityTimer();
        if(saved&&!pendingDraft&&!OFFLINE_MODE&&!deferredDraftRecovery)await clearDraftRecord();
        if(saved){const feedback=checkFeedback.get(id);setTimeout(()=>{if(checkFeedback.get(id)===feedback){checkFeedback.delete(id);renderCheckFeedback();}},3500);}
      }
    });
  }
  function checklistEditorDirty(){return !$('#checklistDialog').hidden&&checklistShape(checklistEditorItems)!==checklistShape(checklistEditorBase);}
  async function openChecklistEditor() {
    if(pendingChecks.size||checklistSaving)return;
    checklistEditorBase=checklistItems(captureState());
    if(!OFFLINE_MODE&&checklistShape(checklistEditorBase)===checklistShape(checklistItems(lastSavedState))){
      try{const latest=await fetchPublishedState();if(latest?.content?.html)checklistEditorBase=checklistItems(normalizeState(migratePublishedState(latest.content)));}catch(_){}
    }
    checklistEditorItems=clone(checklistEditorBase);newChecklistItemIds.clear();
    $('#checklistEditorError').textContent='';renderChecklistEditor();showDialog($('#checklistDialog'));syncChecklistControls();
  }
  function renderChecklistEditor() {
    $('#checklistEditorRows').innerHTML=checklistEditorItems.map((item,index)=>'<div class="checklist-editor-row"><input type="checkbox" disabled aria-label="완료 상태"'+(item.checked?' checked':'')+'><textarea class="checklist-text" rows="2" data-check-index="'+index+'" aria-label="항목 '+(index+1)+'" placeholder="새 체크 항목">'+escapeHtml(item.text)+'</textarea><div class="checklist-row-actions"><button type="button" data-check-action="up" data-index="'+index+'" aria-label="위로 이동"'+(index===0?' disabled':'')+'>↑</button><button type="button" data-check-action="down" data-index="'+index+'" aria-label="아래로 이동"'+(index===checklistEditorItems.length-1?' disabled':'')+'>↓</button><button type="button" data-check-action="delete" data-index="'+index+'">삭제</button></div></div>').join('');
  }
  function addChecklistItem() {
    if(checklistEditorSaving||$('#checklistDialog').hidden)return;
    let id;do{id=uid('check');}while(checklistEditorItems.some(item=>item.id===id));
    newChecklistItemIds.add(id);checklistEditorItems.push({id,text:'',checked:false});
    renderChecklistEditor();
    const row=$$('#checklistEditorRows .checklist-editor-row').at(-1),checkbox=row.querySelector('input[type="checkbox"]');
    checkbox.defaultChecked=false;checkbox.checked=false;row.querySelector('.checklist-text').focus();
  }
  async function saveChecklistEditor() {
    if(checklistEditorSaving)return;
    const items=checklistEditorItems.map(item=>({...item,text:item.text.trim()}));
    if(items.some(item=>!item.text)){$('#checklistEditorError').textContent='빈 항목을 입력하거나 삭제해 주세요.';return;}
    if(checklistShape(items)===checklistShape(checklistEditorBase)){$('#checklistDialog').hidden=true;syncChecklistControls();return;}
    checklistEditorSaving=true;$('#checklistSave').textContent='저장 중…';
    $$('#checklistDialog button,#checklistDialog .checklist-text').forEach(el=>el.disabled=true);
    try{
      let publishedItems;
      await commitChecklistPatch((state,remotePass)=>{
        if(remotePass){
          const latest=checklistItems(state),shape=checklistShape(latest);
          if(shape!==checklistShape(checklistEditorBase)&&shape!==checklistShape(items))throw new Error('다른 곳에서 목록이 변경되었습니다. 취소 후 다시 열어 주세요.');
          publishedItems=items.map(item=>({...item,checked:remotePass!=='verified'&&newChecklistItemIds.has(item.id)?false:latest.find(old=>old.id===item.id)?.checked??false}));
        }
        return patchChecklist(state,publishedItems);
      },'준비 목록 편집',state=>checklistShape(checklistItems(state))===checklistShape(items));
      $('#checklistDialog').hidden=true;checkFeedback.clear();renderCheckFeedback();updateDirtyState();
      if(!pendingDraft&&!OFFLINE_MODE&&!deferredDraftRecovery)await clearDraftRecord();
      setStatus(OFFLINE_MODE?'목록을 이 브라우저에 저장했습니다.':'목록 저장됨');
    }catch(error){
      // Submitted IDs may now exist remotely. A later explicit retry must retain
      // completion changes made after that uncertain commit.
      if(error.uncertain)newChecklistItemIds.clear();
      $('#checklistEditorError').textContent=error.uncertain||/다른 곳|브라우저/.test(error.message||'')?error.message:'저장 실패 · 다시 시도해 주세요.';
    }
    finally{checklistEditorSaving=false;$('#checklistSave').textContent='저장';$('#checklistSave').disabled=false;$('#checklistCancel').disabled=false;$('#checklistAdd').disabled=false;renderChecklistEditor();syncChecklistControls();resetInactivityTimer();}
  }

  function decorateChecklist() {
    const seenCheckIds=new Set();
    $$('.checklist label').forEach(label=>{
      if(!label.dataset.checkId||seenCheckIds.has(label.dataset.checkId))label.dataset.checkId=uid('check');seenCheckIds.add(label.dataset.checkId);
      let span=label.querySelector('span');
      if(!span){ span=document.createElement('span'); span.textContent=Array.from(label.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim(); Array.from(label.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove()); label.appendChild(span); }
      if(!label.querySelector('.check-delete')){ const b=document.createElement('button'); b.type='button'; b.className='check-delete'; b.textContent='삭제'; label.appendChild(b); }
      if(!label.querySelector('.check-actions')){const actions=document.createElement('span');actions.className='check-actions';actions.contentEditable='false';actions.innerHTML='<button class="check-move" data-icon="up" data-move-check="'+escapeHtml(label.dataset.checkId)+'" data-move-direction="-1" type="button" aria-label="위로 이동"></button><button class="check-move" data-icon="down" data-move-check="'+escapeHtml(label.dataset.checkId)+'" data-move-direction="1" type="button" aria-label="아래로 이동"></button>';label.insertBefore(actions,label.querySelector('.check-delete'));decorateButtonIcons(actions);}
    });
    $$('.checklist label>span[data-placeholder]').forEach(updateEditableEmpty);
    updateChecklistMoveButtons();
  }
  function updateChecklistMoveButtons(){const labels=$$('.prepday .checklist label');labels.forEach((label,index)=>{const buttons=label.querySelectorAll('[data-move-check]');if(buttons[0])buttons[0].disabled=index===0;if(buttons[1])buttons[1].disabled=index===labels.length-1;});}
  function mapPlaceName(anchor) {
    if(!anchor)return '';
    const stored=anchor?.dataset.placeName?.trim();
    if(stored)return stored;
    const raw=(anchor?.querySelector('.map-link-label')?.textContent||anchor?.textContent||'').replace(/↗/g,'').trim();
    return raw.replace(/^Google Maps\s*[·-]\s*/i,'').replace(/\s*[·-]\s*Google Maps$/i,'').trim()||'위치';
  }
  function decorateMapLink(map) {
    const anchor=map?.querySelector('a');if(!anchor)return;
    const place=mapPlaceName(anchor);anchor.dataset.placeName=place;anchor.className='map-link';
    anchor.setAttribute('aria-label','Google Maps · '+place+' (새 창)');
    anchor.innerHTML=iconSvg('map')+'<span class="map-link-label">Google Maps · '+escapeHtml(place)+'</span><span class="map-link-arrow" aria-hidden="true">↗</span>';
  }
  function updatePhotoMoveButtons(gallery){if(!gallery)return;const figures=Array.from(gallery.querySelectorAll(':scope > .schedule-photo'));figures.forEach((figure,index)=>{const buttons=figure.querySelectorAll('[data-move-photo]');if(buttons[0])buttons[0].disabled=index===0;if(buttons[1])buttons[1].disabled=index===figures.length-1;});}
  function decoratePhotoFigure(figure,seenPhotoIds=null){
    if(!figure.dataset.photoId||seenPhotoIds?.has(figure.dataset.photoId))figure.dataset.photoId=uid('photo');seenPhotoIds?.add(figure.dataset.photoId);
    const img=figure.querySelector('img');if(!img)return;img.loading='lazy';img.decoding='async';img.fetchPriority='low';
    let caption=figure.querySelector('figcaption');if(!caption){caption=document.createElement('figcaption');caption.textContent=img.alt||'일정 사진';figure.appendChild(caption);}
    if(!figure.classList.contains('map-capture')){img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',(caption.textContent.trim()||img.alt||'일정 사진')+' 크게 보기');}
    figure.querySelector(':scope > .photo-delete')?.remove();
    let actions=figure.querySelector(':scope > .photo-actions');
    if(!actions){actions=document.createElement('span');actions.className='photo-actions';actions.innerHTML='<button class="photo-action" data-icon="up" data-move-photo="-1" type="button" aria-label="사진을 앞으로 이동"></button><button class="photo-action" data-icon="down" data-move-photo="1" type="button" aria-label="사진을 뒤로 이동"></button><button class="photo-action" data-icon="edit" data-edit-photo type="button" aria-label="사진 정보 편집"></button><button class="photo-action delete" data-delete-photo type="button" aria-label="사진 삭제">×</button>';figure.appendChild(actions);decorateButtonIcons(actions);}
  }
  function updateScheduleMoveButtons(){$$('main .day:not(.prepday):not(.moneyday)').forEach(panel=>{const rows=Array.from(panel.querySelectorAll(':scope > .timeline-row'));rows.forEach((row,index)=>{const buttons=row.querySelectorAll('[data-move-row]');if(buttons[0])buttons[0].disabled=index===0;if(buttons[1])buttons[1].disabled=index===rows.length-1;});});}
  function updateScheduleKindControl(row){
    const select=row.querySelector('.schedule-kind-select');if(!select)return;
    const mode=scheduleKindMode(row.dataset.scheduleKind),title=row.querySelector('h3')?.textContent||'',chip=row.querySelector('.chip')?.textContent||'',automatic=timetableKind(title,chip),effective=timetableKind(title,chip,mode);
    select.value=mode;select.options[0].textContent='자동 ('+TIMETABLE_KINDS[automatic]+')';
    select.closest('.schedule-kind-control').className='schedule-kind-control tt-kind-'+effective;
  }
  function changeScheduleKind(select){
    const row=select.closest('.timeline-row');if(!row)return;
    if(!body.classList.contains('editing')){updateScheduleKindControl(row);return;}
    clearTimeout(historyTimer);recordHistory();
    const mode=scheduleKindMode(select.value);if(mode==='auto')delete row.dataset.scheduleKind;else row.dataset.scheduleKind=mode;
    updateScheduleKindControl(row);recordHistory();resetInactivityTimer();
  }
  function updateEditableEmpty(element){element.dataset.empty=String(!element.textContent.trim());}
  function decorateEditablePlaceholders(root){
    [['h3','일정 제목'],['.remark','장소 또는 메모'],['.schedule-warning-text','주의사항']].forEach(([selector,label])=>{
      root.querySelectorAll(selector).forEach(element=>{element.dataset.placeholder=label;updateEditableEmpty(element);});
    });
  }
  function decorateScheduleRows() {
    const seenRowIds=new Set(),seenPhotoIds=new Set();
    $$('.timeline-row').forEach((row,index)=>{
      if(!row.dataset.rowId||seenRowIds.has(row.dataset.rowId))row.dataset.rowId='row-'+hashText((row.closest('.day')?.className||'')+'-'+index+'-'+row.textContent+'-'+uid());seenRowIds.add(row.dataset.rowId);
      const card=row.querySelector('.card');if(!card)return;
      row.querySelector(':scope > .row-delete')?.remove();
      let rowActions=row.querySelector(':scope > .row-actions');
      if(!rowActions){rowActions=document.createElement('span');rowActions.className='row-actions';rowActions.innerHTML='<button class="row-action" data-icon="up" data-move-row="-1" type="button" aria-label="일정을 위로 이동"></button><button class="row-action" data-icon="down" data-move-row="1" type="button" aria-label="일정을 아래로 이동"></button><button class="row-action delete" data-delete-row type="button" aria-label="일정 삭제">×</button>';row.appendChild(rowActions);decorateButtonIcons(rowActions);}
      if(!card.querySelector('.schedule-media-tools')){const tools=document.createElement('div');tools.className='schedule-media-tools';tools.innerHTML='<button data-media="time" data-icon="edit" type="button">시간 설정</button><button data-media="photo" data-icon="photo" type="button">사진 첨부</button><button data-media="map" data-icon="map" type="button">지도 첨부</button><button data-media="warning" data-icon="alert" type="button">주의사항 추가</button>';card.appendChild(tools);decorateButtonIcons(tools);}
      const mediaTools=card.querySelector('.schedule-media-tools');
      if(!mediaTools.querySelector('.schedule-kind-control')){const label=document.createElement('label');label.className='schedule-kind-control';label.innerHTML='<span>일정 분류</span><i aria-hidden="true"></i><select class="schedule-kind-select" aria-label="일정 분류"><option value="auto">자동</option>'+Object.entries(TIMETABLE_KINDS).map(([value,name])=>'<option value="'+value+'">'+name+'</option>').join('')+'</select>';mediaTools.prepend(label);}
      updateScheduleKindControl(row);
      card.querySelectorAll('.schedule-warning').forEach(warning=>{let text=warning.querySelector('.schedule-warning-text');if(!text){const value=warning.textContent.trim();warning.textContent='';text=document.createElement('span');text.className='schedule-warning-text';text.textContent=value;warning.appendChild(text);}if(!warning.querySelector('.warning-delete')){const button=document.createElement('button');button.className='warning-delete';button.type='button';button.textContent='삭제';warning.appendChild(button);}});
      decorateEditablePlaceholders(card);
      card.querySelectorAll('.schedule-photo').forEach(figure=>decoratePhotoFigure(figure,seenPhotoIds));
      card.querySelectorAll('.schedule-gallery').forEach(updatePhotoMoveButtons);
      const map=card.querySelector('.schedule-map');if(map){decorateMapLink(map);if(!map.querySelector('.schedule-map-delete')){const button=document.createElement('button');button.className='schedule-map-delete';button.type='button';button.textContent='삭제';map.appendChild(button);}}
    });
    updateScheduleMoveButtons();
  }
