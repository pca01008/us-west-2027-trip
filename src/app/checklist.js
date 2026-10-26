function createChecklistController({$,$$,OFFLINE_MODE,SCHEMA_VERSION,TRIP_ID,applyStatePreservingInputs,body,captureState,checkLabelText,clearDraftRecord,clone,decorateButtonIcons,documentSession,draftWorkflow,escapeHtml,fetchPublishedState,fingerprint,isOperationBusy,isRevisionConflict,isSaveInFlight,migratePublishedState,normalizeState,recordHistory,requireEditor,resetInactivityTimer,runtimeOptions,setStatus,showDialog,tripRepository,uid,updateDirtyState,updateEditableEmpty,writeDraftRecord,writePublicCache}) {
const pendingChecks = new Map();
const checkFeedback = new Map();
let checklistQueue = Promise.resolve();
let checklistSaving = false;
let checklistAuthPending = false;
let checklistEditorBase = [];
let checklistEditorItems = [];
const newChecklistItemIds = new Set();
let checklistEditorSaving = false;

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
    $$('.prepday .checklist input[type="checkbox"]').forEach(input=>{input.disabled=body.classList.contains('editing')||body.classList.contains('previewing')||isOperationBusy()||checklistAuthPending||pendingChecks.has(input.closest('label').dataset.checkId)||!$('#checklistDialog').hidden;});
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

  async function commitChecklistPatch(transform,note,isApplied) {
    if(documentSession.snapshot().documentWriteBlock)throw new Error(documentSession.snapshot().documentWriteBlock);
    if(isSaveInFlight()||isOperationBusy())throw new Error('다른 저장이 끝난 뒤 다시 시도해 주세요.');
    checklistSaving=true;syncChecklistControls();
    try {
      for(let attempt=0;attempt<3;attempt++) {
        const row=OFFLINE_MODE?null:await fetchPublishedState();
        if(!OFFLINE_MODE&&!row)throw new Error('공유 저장본을 확인하지 못했습니다.');
        const remote=row?.content?.html?normalizeState(migratePublishedState(row.content)):clone(documentSession.snapshot().lastSavedState);
        let saved=normalizeState(transform(remote,true));
        let result={revision:documentSession.snapshot().publishedRevision,updated_at:documentSession.snapshot().publishedUpdatedAt};
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
              if(latestState)documentSession.rememberRemote(latest,latestState);
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
        const localBefore=captureState(),baseBefore=clone(documentSession.snapshot().lastSavedState);
        const nextLocal=transform(localBefore),nextBase=normalizeState(transform(baseBefore));
        if(OFFLINE_MODE){
          draftWorkflow.cancelPendingWrites();
          const dirty=fingerprint(nextLocal)!==fingerprint(nextBase);
          const ok=await writeDraftRecord({tripId:TRIP_ID,schemaVersion:SCHEMA_VERSION,state:nextLocal,baseState:nextBase,baseRevision:documentSession.snapshot().publishedRevision,baseUpdatedAt:documentSession.snapshot().publishedUpdatedAt,savedAt:new Date().toISOString(),dirty});
          if(!ok)throw new Error('브라우저에 저장하지 못했습니다. 다시 시도해 주세요.');
        }
        const persistedItems=checklistItems(nextLocal);pendingChecks.forEach((pending,id)=>{const item=persistedItems.find(item=>item.id===id);if(item)pending.before=item.checked;});
        const noOtherDraft=fingerprint(localBefore)===fingerprint(baseBefore)&&!body.classList.contains('editing');
        if(noOtherDraft&&!OFFLINE_MODE){
          applyStatePreservingInputs(saved);
          // captureState deliberately excludes optimistic values still in flight.
          documentSession.acceptPrepResult({nextBase,saved,result,noOtherDraft,offline:OFFLINE_MODE,localBaseline:captureState()});
        }else{
          applyStatePreservingInputs(nextLocal);documentSession.acceptPrepResult({nextBase,saved,result,noOtherDraft,offline:OFFLINE_MODE});
        }
        documentSession.reconcileHistory(transform);
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
    if(body.classList.contains('editing')||body.classList.contains('previewing')||isOperationBusy())return;
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
        if(saved&&!documentSession.snapshot().pendingDraft&&!OFFLINE_MODE&&!draftWorkflow.isRecoveryDeferred())await clearDraftRecord();
        if(saved){const feedback=checkFeedback.get(id);setTimeout(()=>{if(checkFeedback.get(id)===feedback){checkFeedback.delete(id);renderCheckFeedback();}},3500);}
      }
    });
  }
  function checklistEditorDirty(){return !$('#checklistDialog').hidden&&checklistShape(checklistEditorItems)!==checklistShape(checklistEditorBase);}
  async function openChecklistEditor() {
    if(pendingChecks.size||checklistSaving)return;
    checklistEditorBase=checklistItems(captureState());
    if(!OFFLINE_MODE&&checklistShape(checklistEditorBase)===checklistShape(checklistItems(documentSession.snapshot().lastSavedState))){
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
      if(!documentSession.snapshot().pendingDraft&&!OFFLINE_MODE&&!draftWorkflow.isRecoveryDeferred())await clearDraftRecord();
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











async function addCheckRow(){if($('.day-radio:checked')?.id!=='prep')return;await requireEditor('checklist',async()=>{await openChecklistEditor();addChecklistItem();});}

function moveCheck(id,direction){if(!body.classList.contains('editing'))return;const labels=$$('.prepday .checklist label'),index=labels.findIndex(label=>label.dataset.checkId===id),next=index+direction;if(index<0||next<0||next>=labels.length)return;const label=labels[index],target=labels[next];if(direction<0)target.before(label);else target.after(label);updateChecklistMoveButtons();recordHistory();}
function pendingCheckCount(){return pendingChecks.size;}
function pendingCheckBefore(id){return pendingChecks.get(id)?.before;}
function isChecklistSaving(){return checklistSaving;}
function isChecklistEditorSaving(){return checklistEditorSaving;}
function checklistEditorSnapshot(){return clone(checklistEditorItems);}

function bindChecklistControls(){
$('#addCheckBtn').onclick=addCheckRow;
document.addEventListener('click',event=>{if(isOperationBusy())return;
if(event.target.classList.contains('check-delete')&&body.classList.contains('editing')){event.target.closest('label')?.remove();updateChecklistMoveButtons();recordHistory();return;}
const checkMove=event.target.closest('[data-move-check]');if(checkMove&&!checkMove.disabled){moveCheck(checkMove.dataset.moveCheck,Number(checkMove.dataset.moveDirection));return;}
});
document.addEventListener('change',async event=>{if(event.target.matches('.prepday .checklist input[type="checkbox"]')){await requestCheckToggle(event.target);return;}});
document.addEventListener('click',event=>{if((pendingChecks.size||checklistSaving)&&event.target.closest('.editor-bar')){event.preventDefault();event.stopImmediatePropagation();}},true);
$('#checklistAdd').onclick=addChecklistItem;
$('#checklistCancel').onclick=()=>{if(!checklistEditorSaving){$('#checklistDialog').hidden=true;syncChecklistControls();}};
$('#checklistSave').onclick=()=>void saveChecklistEditor();
$('#checklistEditorRows').addEventListener('input',event=>{const index=Number(event.target.dataset.checkIndex);if(event.target.matches('.checklist-text')&&checklistEditorItems[index])checklistEditorItems[index].text=event.target.value;resetInactivityTimer();});
$('#checklistEditorRows').addEventListener('click',event=>{const button=event.target.closest('[data-check-action]');if(!button||button.disabled)return;const index=Number(button.dataset.index),action=button.dataset.checkAction;if(action==='delete')checklistEditorItems.splice(index,1);else{const next=index+(action==='up'?-1:1);[checklistEditorItems[index],checklistEditorItems[next]]=[checklistEditorItems[next],checklistEditorItems[index]];}renderChecklistEditor();const rows=$$('#checklistEditorRows .checklist-editor-row');rows[Math.min(index,rows.length-1)]?.querySelector('.checklist-text')?.focus();});
document.addEventListener('click',event=>{const retry=event.target.closest('[data-retry-check]');if(!retry)return;const item=checkFeedback.get(retry.dataset.retryCheck);if(item)void authorizeCheck(retry.dataset.retryCheck,item.value);});
}

return Object.freeze({checklistItems,checklistShape,patchCheck,patchChecklist,syncChecklistControls,renderCheckFeedback,commitChecklistPatch,authorizeCheck,requestCheckToggle,queueCheck,checklistEditorDirty,openChecklistEditor,renderChecklistEditor,addChecklistItem,saveChecklistEditor,decorateChecklist,updateChecklistMoveButtons,addCheckRow,moveCheck,pendingCheckCount,pendingCheckBefore,isChecklistSaving,isChecklistEditorSaving,checklistEditorSnapshot,bindChecklistControls});
}
