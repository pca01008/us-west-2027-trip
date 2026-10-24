  function stateSummary(state){const template=document.createElement('template');template.innerHTML=state.html;const schedules=[];template.content.querySelectorAll('.day:not(.prepday):not(.moneyday)').forEach((day,dayIndex)=>day.querySelectorAll('.timeline-row').forEach((row,index)=>{const mapLink=row.querySelector('.schedule-map a');schedules.push({id:row.dataset.rowId||'position-'+dayIndex+'-'+index,key:'DAY '+(dayIndex+1)+' 일정 '+(index+1),dayIndex,index,stay:row.dataset.stayCheckout||'',kind:TIMETABLE_KINDS[scheduleKindMode(row.dataset.scheduleKind)]||'자동',time:row.querySelector('.time')?.textContent.trim()||'',title:row.querySelector('h3')?.textContent.trim()||'',detail:row.querySelector('.remark')?.textContent.trim()||'',warning:Array.from(row.querySelectorAll('.schedule-warning')).map(item=>(item.querySelector('.schedule-warning-text')||item).textContent.trim()).filter(Boolean).join(' | '),mapName:mapPlaceName(mapLink),map:mapLink?.href||'',photos:Array.from(row.querySelectorAll('.schedule-photo')).map(photo=>{const img=photo.querySelector('img');return {id:photo.dataset.photoId||photo.dataset.fullPath||'photo',caption:photo.querySelector('figcaption')?.textContent.trim()||'',alt:img?.alt||''};})});}));const checks=Array.from(template.content.querySelectorAll('.checklist label span')).map((span,index)=>({id:span.closest('label')?.dataset.checkId||'position-'+index,text:span.textContent.trim(),important:span.closest('label')?.dataset.checkImportant==='true',checked:Boolean(state.checks?.[index])}));const days=Array.from(template.content.querySelectorAll('.day:not(.prepday):not(.moneyday)')).map(day=>day.querySelector('.day-head p')?.textContent.trim()||'');return {days,schedules,checks,expenses:state.expenses,categories:state.categories,exchangeRate:state.exchangeRate};}
  function buildDiff(beforeState,afterState){
    const before=stateSummary(beforeState),after=stateSummary(afterState),groups=[];
    const addGroup=(title,items)=>{if(items.length)groups.push({title,items});};
    const value=value=>String(value??'').trim()||'없음';
    const scheduleChanges=[];
    after.days.forEach((subtitle,index)=>{if(subtitle!==before.days[index])scheduleChanges.push('DAY '+(index+1)+' 설명: '+value(before.days[index])+' → '+value(subtitle));});
    const beforeSchedules=new Map(before.schedules.map(item=>[item.id,item]));
    const afterSchedules=new Map(after.schedules.map(item=>[item.id,item]));
    before.schedules.forEach(item=>{if(!afterSchedules.has(item.id))scheduleChanges.push(item.key+' 삭제: '+value(item.time)+' · '+value(item.title));});
    after.schedules.forEach(item=>{
      const old=beforeSchedules.get(item.id);
      if(!old){scheduleChanges.push(item.key+' 추가: '+value(item.time)+' · '+value(item.title));return;}
      [['숙박 종료일','stay'],['시간','time'],['제목','title'],['분류','kind'],['상세','detail'],['주의사항','warning'],['지도 장소','mapName'],['지도 링크','map']].forEach(([label,key])=>{if(old[key]!==item[key])scheduleChanges.push(item.key+' '+label+': '+value(old[key])+' → '+value(item[key]));});
      if(JSON.stringify(old.photos)!==JSON.stringify(item.photos))scheduleChanges.push(item.key+' 사진 구성·순서·설명 변경');
    });
    const beforeScheduleOrder=before.schedules.map(item=>item.id),afterScheduleOrder=after.schedules.map(item=>item.id),sameSchedules=beforeScheduleOrder.length===afterScheduleOrder.length&&beforeScheduleOrder.every(id=>afterSchedules.has(id));
    if(sameSchedules&&beforeScheduleOrder.join('|')!==afterScheduleOrder.join('|'))scheduleChanges.push('일정 표시 순서 변경');
    addGroup('일정',scheduleChanges);
    const checkChanges=[],beforeChecks=new Map(before.checks.map(item=>[item.id,item])),afterChecks=new Map(after.checks.map(item=>[item.id,item]));
    before.checks.forEach(item=>{if(!afterChecks.has(item.id))checkChanges.push('항목 삭제: '+value(item.text));});
    after.checks.forEach(item=>{const old=beforeChecks.get(item.id);if(!old)checkChanges.push('항목 추가: '+value(item.text));else{if(old.important!==item.important)checkChanges.push(value(item.text)+' 중요 표시: '+(old.important?'켜짐':'꺼짐')+' → '+(item.important?'켜짐':'꺼짐'));if(old.text!==item.text)checkChanges.push('항목 내용: '+value(old.text)+' → '+value(item.text));if(old.checked!==item.checked)checkChanges.push(value(item.text)+': '+(old.checked?'완료':'미완료')+' → '+(item.checked?'완료':'미완료'));}});
    const beforeCheckOrder=before.checks.map(item=>item.id),afterCheckOrder=after.checks.map(item=>item.id),sameChecks=beforeCheckOrder.length===afterCheckOrder.length&&beforeCheckOrder.every(id=>afterChecks.has(id));
    if(sameChecks&&beforeCheckOrder.join('|')!==afterCheckOrder.join('|'))checkChanges.push('체크리스트 순서 변경');
    addGroup('체크리스트',checkChanges);
    const expenseChanges=[],beforeExpenses=new Map(before.expenses.map(item=>[item.id,item])),afterExpenses=new Map(after.expenses.map(item=>[item.id,item]));
    const expenseCategoryName=(id,list)=>{const category=list.find(item=>item.id===id);return category?category.icon+' '+category.name:id;};
    before.expenses.forEach(item=>{if(!afterExpenses.has(item.id))expenseChanges.push('내역 삭제: '+value(item.name)+' · '+item.amountKrw+' '+CURRENCY_CODES.base+' · '+item.amountUsd+' '+CURRENCY_CODES.quote);});
    after.expenses.forEach(item=>{const old=beforeExpenses.get(item.id);if(!old){expenseChanges.push('내역 추가: '+value(item.name)+' · '+item.amountKrw+' '+CURRENCY_CODES.base+' · '+item.amountUsd+' '+CURRENCY_CODES.quote);return;}const changes=[];if(old.date!==item.date)changes.push('날짜 '+value(old.date)+' → '+value(item.date));if(old.name!==item.name)changes.push('항목 '+value(old.name)+' → '+value(item.name));if(old.categoryId!==item.categoryId)changes.push('카테고리 '+expenseCategoryName(old.categoryId,before.categories)+' → '+expenseCategoryName(item.categoryId,after.categories));for(const [key,label] of [['amountKrw',currencyLabel('krw')],['amountUsd',currencyLabel('usd')],['amountSource','입력 출처'],['appliedExchangeRate','적용 환율']])if(old[key]!==item[key])changes.push(label+' '+value(old[key])+' → '+value(item[key]));if(changes.length)expenseChanges.push('내역 변경 · '+value(item.name)+': '+changes.join(', '));});
    const beforeOrder=before.expenses.map(item=>item.id),afterOrder=after.expenses.map(item=>item.id),sameItems=beforeOrder.length===afterOrder.length&&beforeOrder.every(id=>afterExpenses.has(id));
    if(sameItems&&beforeOrder.join('|')!==afterOrder.join('|'))expenseChanges.push('내역 표시 순서 변경');
    addGroup('가계부 내역',expenseChanges);
    const categoryChanges=[],beforeCategories=new Map(before.categories.map(item=>[item.id,item])),afterCategories=new Map(after.categories.map(item=>[item.id,item]));
    before.categories.forEach(item=>{if(!afterCategories.has(item.id))categoryChanges.push('카테고리 삭제: '+item.icon+' '+item.name);});
    after.categories.forEach(item=>{const old=beforeCategories.get(item.id);if(!old)categoryChanges.push('카테고리 추가: '+item.icon+' '+item.name);else if(old.name!==item.name||old.icon!==item.icon)categoryChanges.push('카테고리 변경: '+old.icon+' '+old.name+' → '+item.icon+' '+item.name);});
    addGroup('가계부 카테고리',categoryChanges);
    if(before.exchangeRate!==after.exchangeRate)addGroup('환율',['1 '+CURRENCY_CODES.quote+' = '+before.exchangeRate+' '+CURRENCY_CODES.base+' → '+after.exchangeRate+' '+CURRENCY_CODES.base]);
    return groups;
  }
  function renderDiff(summary,list,groups,message=''){const count=groups.reduce((sum,group)=>sum+group.items.length,0);summary.textContent=message||(count?count+'개 변경 사항이 있습니다.':'변경 사항이 없습니다.');list.innerHTML=groups.length?groups.map(group=>'<div class="diff-group"><strong>'+escapeHtml(group.title)+'</strong><ul>'+group.items.slice(0,80).map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul></div>').join(''):'<div class="diff-empty">변경 사항이 없습니다.</div>';return count;}
  function renderImportDiff(groups,message=''){const count=renderDiff($('#importSummary'),$('#importDiff'),groups,message||(groups.length?'불러오면 현재 화면의 초안으로 적용됩니다.':'최신 저장본과 동일합니다.'));$('#importApply').disabled=!count;}
  async function chooseImportFile(){await requireEditor('import',()=>$('#importFileInput').click());}
  async function readImportFile(file){
    try{
      const source=await file.text(),doc=new DOMParser().parseFromString(source,'text/html');
      if(doc.documentElement.dataset.tripId!==TRIP_ID||doc.documentElement.dataset.offline!=='true')throw new Error('이 여행에서 만든 오프라인 작업본이 아닙니다.');
      const validateVersion=value=>{const version=Number(value);if(!Number.isInteger(version)||version<1)throw new Error('파일 버전을 확인할 수 없습니다.');if(version>SCHEMA_VERSION)throw new Error('더 새로운 버전에서 만든 파일입니다. 온라인 페이지를 먼저 업데이트해 주세요.');return version;};
      const fileVersion=validateVersion(doc.documentElement.dataset.schemaVersion);
      const embedded=doc.querySelector('#offlineEmbeddedState');if(!embedded)throw new Error('편집 데이터가 없습니다.');
      const raw=JSON.parse(embedded.textContent);
      if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.html!=='string'||!raw.html.trim())throw new Error('편집 데이터가 없습니다.');
      const schemaVersion=raw.schemaVersion===undefined?fileVersion:validateVersion(raw.schemaVersion);
      const incoming=normalizeState(migratePublishedState({...raw,schemaVersion}),true),published=await fetchPublishedState();
      const current=normalizeState(published?.content?.html?migratePublishedState(published.content):lastSavedState),groups=buildDiff(current,incoming);
      pendingImport={state:incoming,baselineRevision:Math.max(0,Number(published?.revision)||0),baselineUpdatedAt:published?.updated_at||'',current};renderImportDiff(groups);$('#importDialog').hidden=false;
    }catch(error){console.error(error);await showChoice({title:'작업본을 불러올 수 없습니다.',message:error.message,choices:[{label:'확인',value:'ok',className:'action-primary'}]});}
    finally{$('#importFileInput').value='';}
  }
  async function materializeImportedPhotos(state){const normalized=normalizeState(state,true),template=document.createElement('template');template.innerHTML=normalized.html;for(const figure of template.content.querySelectorAll('.schedule-photo')){const img=figure.querySelector('img'),fullPath=figure.dataset.fullPath,thumbPath=figure.dataset.thumbPath;if(fullPath&&thumbPath){img.src=publicMediaUrl(thumbPath);img.dataset.fullUrl=publicMediaUrl(fullPath);continue;}if(!img.src.startsWith('data:image/'))continue;img.dataset.fullUrl=img.dataset.fullUrl||img.src;figure.dataset.staged='true';delete figure.dataset.fullPath;delete figure.dataset.thumbPath;}normalized.html=template.innerHTML;return normalized;}
  async function applyImportedDraft(){if(!pendingImport)return;try{const published=await fetchPublishedState(),remoteRevision=Math.max(0,Number(published?.revision)||0);if(remoteRevision!==pendingImport.baselineRevision){if(!published?.content?.html)throw new Error('최신 저장본을 다시 확인하지 못했습니다.');const current=normalizeState(migratePublishedState(published.content)),groups=buildDiff(current,pendingImport.state);pendingImport.current=current;pendingImport.baselineRevision=remoteRevision;pendingImport.baselineUpdatedAt=published.updated_at||'';renderImportDiff(groups,'비교 중 최신 저장본이 변경되어 차이를 다시 계산했습니다. 내용을 확인하고 한 번 더 불러오세요.');return;}setStatus('편집본 사진을 준비 중입니다.');const incoming=await materializeImportedPhotos(pendingImport.state);lastSavedState=clone(pendingImport.current);draftBaselineUnknown=false;publishedRevision=pendingImport.baselineRevision;publishedUpdatedAt=pendingImport.baselineUpdatedAt;applyState(incoming);initializeHistory();updateDirtyState();$('#importDialog').hidden=true;pendingImport=null;setStatus('편집본 불러옴 · 저장되지 않음');}catch(error){console.error(error);setStatus('편집본 적용 실패');await showChoice({title:'편집본 적용 실패',message:error.message,choices:[{label:'확인',value:'ok',className:'action-primary'}]});}}

  async function resetDraft(){const choice=await showChoice({title:'마지막 저장본으로 초기화',message:'현재 변경을 삭제하고 마지막 저장본으로 되돌립니다.',choices:[{label:'취소',value:'cancel'},{label:'초기화',value:'reset',className:'action-danger'}]});if(choice==='reset')discardDraft('마지막 저장본으로 초기화했습니다.');}
  async function confirmSave(){if(!pendingDraft){setStatus('저장할 변경이 없습니다.');return;}const choice=await showChoice({title:OFFLINE_MODE?'오프라인 작업본 저장':'공유 일정에 저장',message:OFFLINE_MODE?'수정된 내용을 포함한 새 작업본을 내려받습니다.':'저장하면 공개 링크에 변경 내용이 반영됩니다.',input:OFFLINE_MODE?null:{label:'버전 메모 (선택)','placeholder':'예: 항공편 시간 수정'},choices:[{label:'취소',value:'cancel'},{label:'저장',value:'save',className:'action-primary'}]});if(choice==='save')await saveAndFinish(noticeInputValue||'수동 저장');}
  function formatBytes(value){const size=Number(value)||0;if(size<1024)return size+' B';if(size<1024*1024)return (size/1024).toFixed(1)+' KB';return (size/1024/1024).toFixed(1)+' MB';}
  async function loadVersionContent(version){if(versionContentCache.has(version.id))return clone(versionContentCache.get(version.id));setStatus('버전 #'+version.id+' 불러오는 중');const {data,error}=await client.from('trip_document_versions').select('content').eq('trip_id',TRIP_ID).eq('id',version.id).single();if(error||!data?.content)throw error||new Error('버전 본문이 없습니다.');const state=normalizeState(migratePublishedState(data.content));versionContentCache.set(version.id,state);while(versionContentCache.size>5)versionContentCache.delete(versionContentCache.keys().next().value);return clone(state);}
  async function previewVersion(version){
    if(saveInFlight||operationBusy||checklistSaving||pendingChecks.size)return;
    try{
      const state=await loadVersionContent(version);
      if(saveInFlight||operationBusy||checklistSaving||pendingChecks.size)return;
      clearTimeout(historyTimer);recordHistory();await flushDraftPersistence();
      if(saveInFlight||operationBusy||checklistSaving||pendingChecks.size)return;
      // Keep the original working copy even when switching between previews.
      if(!previewReturnState)previewReturnState=captureState();
      body.classList.add('previewing');setEditingUI(false);applyState(state);
      $('#previewLabel').textContent='버전 #'+version.id+' · '+new Date(version.created_at).toLocaleString('ko-KR')+' 미리보기';
      $('#versionDialog').hidden=true;setStatus('과거 저장본 미리보기 · 편집하려면 미리보기를 닫아 주세요.');
    }catch(error){console.error(error);setStatus('버전 본문을 불러오지 못했습니다.');}
  }
  async function compareVersion(version){try{const state=await loadVersionContent(version),groups=buildDiff(captureState(),state);selectedVersion={...version,state};$('#versionCompareTitle').textContent='버전 #'+version.id+' 차이';renderDiff($('#versionCompareSummary'),$('#versionCompareDiff'),groups,(version.note?version.note+' · ':'')+new Date(version.created_at).toLocaleString('ko-KR')+' 저장본과 현재 화면 비교');$('#versionCompareDialog').hidden=false;}catch(error){console.error(error);setStatus('버전 비교에 실패했습니다.');}}
  async function restoreSelectedVersion(){
    if(!selectedVersion)return;
    if(deferredDraftRecovery){if(previewReturnState)closePreview();await recoverOnlineDraft();if(deferredDraftRecovery)return;}
    const hasDraft=isDirty(),choice=await showChoice({title:'버전 #'+selectedVersion.id+'을 복원할까요?',message:hasDraft?'현재 저장하지 않은 초안은 복원본으로 대체됩니다. 복원본은 새 버전으로 저장되어 공개됩니다.':'복원본은 새 버전으로 저장되어 공개됩니다.',choices:[{label:'취소',value:'cancel'},{label:'복원',value:'restore',className:'action-primary'}]});
    if(choice!=='restore')return;
    const restored=clone(selectedVersion.state),id=selectedVersion.id;
    if(body.classList.contains('previewing'))closePreview();
    if(await persistState(restored,{note:'버전 #'+id+' 복원'})){initializeHistory();$('#versionCompareDialog').hidden=true;$('#versionDialog').hidden=true;selectedVersion=null;setStatus('버전 #'+id+'을 새 저장본으로 복원했습니다.');}
  }
  async function openVersions(){if(OFFLINE_MODE)return;const list=$('#versionList');list.innerHTML='<div class="version-empty">저장 목록을 불러오는 중입니다.</div>';$('#versionDialog').hidden=false;const {data,error}=await client.from('trip_document_versions').select('id,note,content_size,created_at').eq('trip_id',TRIP_ID).order('created_at',{ascending:false}).limit(50);if(error){console.error(error);list.innerHTML='<div class="version-empty">목록을 불러오지 못했습니다.</div>';return;}list.innerHTML=data.length?'':'<div class="version-empty">아직 저장된 버전이 없습니다.</div>';data.forEach(version=>{const item=document.createElement('div');item.className='version-item';item.innerHTML='<div><strong>'+escapeHtml(version.note||'버전 #'+version.id)+'</strong><small>#'+version.id+' · '+escapeHtml(new Date(version.created_at).toLocaleString('ko-KR'))+' · '+escapeHtml(formatBytes(version.content_size))+'</small></div><button class="action-muted" type="button">비교</button><button class="action-muted" type="button">미리보기</button><button class="action-primary" type="button">복원</button>';const buttons=item.querySelectorAll('button');buttons[0].onclick=()=>compareVersion(version);buttons[1].onclick=()=>previewVersion(version);buttons[2].onclick=async()=>{await compareVersion(version);};list.appendChild(item);});}
  function closePreview(){if(previewReturnState)applyState(previewReturnState);previewReturnState=null;body.classList.remove('previewing');updateDirtyState();setStatus(pendingDraft?'저장 대기 중':'보기 모드');resetInactivityTimer();}
