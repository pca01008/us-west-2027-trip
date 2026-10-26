function createScheduleController({$,$$,TIMETABLE_KINDS,TRIP_DAYS,body,configDateParts,decorateButtonIcons,documentSession,editScheduleClock,escapeHtml,focusAndSelect,hashText,iconSvg,isOperationBusy,mapPlaceName,openMapDialog,parseTimetableTime,prefersReducedMotion,readScheduleTime,recordHistory,resetInactivityTimer,scheduleClockMask,scheduleClockValue,scheduleKindMode,scheduleTimeValue,selectActiveScheduleRow,showDialog,timetableClock,timetableKind,uid}) {
let scheduleTimeTarget = null;
  function addTimeRow(){const id=$('.day-radio:checked')?.id||'';if(!/^d\d+$/.test(id))return;openScheduleTimeDialog(null,$('.day'+id.slice(1)));}
  function closeScheduleTimeDialog(){$('#scheduleTimeDialog').hidden=true;scheduleTimeTarget=null;}
  function openScheduleTimeDialog(row,panel=row?.closest('.day')) {
    if(!body.classList.contains('editing')||!panel)return;
    documentSession.cancelHistory();recordHistory();
    scheduleTimeTarget={row,panel};
    const {time,zone}=readScheduleTime(row),parsed=parseTimetableTime(time);
    $('#scheduleTimeTitle').textContent=row?'일정 시간 설정':'새 일정 시간';
    $('#scheduleTimeContext').textContent=row?.querySelector('h3')?.textContent.trim()||panel.querySelector('.day-head h2')?.textContent.trim()||'새 일정';
    $('#scheduleTimeSave').textContent=row?'적용':'일정 추가';
    $('#scheduleTimeMode').value=parsed||!row?'exact':'label';
    setScheduleClock($('#scheduleTimeStart'),parsed?timetableClock(parsed.start):'');
    setScheduleClock($('#scheduleTimeEnd'),parsed?.end!=null?timetableClock(parsed.end>1440?parsed.end-1440:parsed.end):'');
    $('#scheduleTimeLabel').value=row?time:'';
    $('#scheduleTimeZone').value=zone;
    updateScheduleTimePreview();showDialog($('#scheduleTimeDialog'));
    const initialInput=$(parsed||!row?'#scheduleTimeStart':'#scheduleTimeLabel');initialInput.focus();if(initialInput.id==='scheduleTimeLabel')initialInput.select();
  }
  function scheduleTimeFormValue(){return scheduleTimeValue({mode:$('#scheduleTimeMode').value,start:scheduleClockValue($('#scheduleTimeStart').value),end:scheduleClockValue($('#scheduleTimeEnd').value),label:$('#scheduleTimeLabel').value});}
  const scheduleClockHistory=new WeakMap();
  function renderScheduleClock(input){const mask=scheduleClockMask(input.value);input.nextElementSibling.innerHTML=mask.split('').map((char,index)=>'<span'+(char==='_'?' class="clock-placeholder"':'')+'>'+escapeHtml(char==='_'?input.placeholder[index]:char)+'</span>').join('');}
  function setScheduleClock(input,value){input.value=scheduleClockValue(value);scheduleClockHistory.set(input,{items:[{value:input.value,caret:0}],index:0});renderScheduleClock(input);}
  function changeScheduleClock(input,type,text=''){
    const result=editScheduleClock(input.value,input.selectionStart??0,input.selectionEnd??0,type,text),history=scheduleClockHistory.get(input);result.value=scheduleClockValue(result.value);
    if(history&&result.value!==input.value){history.items[history.index].caret=input.selectionStart??0;history.items=history.items.slice(0,history.index+1);history.items.push(result);history.index++;}
    input.value=result.value;input.setSelectionRange(result.caret,result.caret);renderScheduleClock(input);updateScheduleTimePreview();
  }
  function undoScheduleClock(input,direction){const history=scheduleClockHistory.get(input),index=(history?.index??0)+direction;if(!history||index<0||index>=history.items.length)return;history.index=index;const result=history.items[index];input.value=result.value;input.setSelectionRange(result.caret,result.caret);renderScheduleClock(input);updateScheduleTimePreview();}
  function initializeScheduleClocks(){
    ['#scheduleTimeStart','#scheduleTimeEnd'].forEach(selector=>{
      const input=$(selector);let pendingNativeEdit=null;setScheduleClock(input,'');
      input.addEventListener('focus',()=>input.setSelectionRange(0,0));
      input.addEventListener('click',()=>{if(!/\d/.test(input.value))input.setSelectionRange(0,0);});
      input.addEventListener('beforeinput',event=>{
        pendingNativeEdit=null;
        if(!event.cancelable){pendingNativeEdit={value:input.value,start:input.selectionStart,end:input.selectionEnd,type:event.inputType,text:event.data};return;}event.preventDefault();
        if(event.inputType==='historyUndo'||event.inputType==='historyRedo'){undoScheduleClock(input,event.inputType==='historyUndo'?-1:1);return;}
        if(event.inputType.startsWith('delete'))changeScheduleClock(input,event.inputType);
        else if(event.data)changeScheduleClock(input,'insertText',event.data);
      });
      input.addEventListener('paste',event=>{event.preventDefault();changeScheduleClock(input,'insertText',event.clipboardData?.getData('text/plain')||'');});
      input.addEventListener('cut',event=>{const start=input.selectionStart,end=input.selectionEnd;if(start===end)return;event.preventDefault();event.clipboardData?.setData('text/plain',input.value.slice(start,end));changeScheduleClock(input,'deleteByCut');});
      input.addEventListener('keydown',event=>{
        if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();undoScheduleClock(input,event.key.toLowerCase()==='y'||event.shiftKey?1:-1);}
        else if(event.key==='Backspace'||event.key==='Delete'){event.preventDefault();changeScheduleClock(input,event.key==='Backspace'?'deleteContentBackward':'deleteContentForward');}
      });
      input.addEventListener('input',()=>{
        const pending=pendingNativeEdit;pendingNativeEdit=null;
        if(pending&&(pending.type.startsWith('delete')||pending.type==='insertText'&&pending.text!==null)){
          input.value=pending.value;input.setSelectionRange(pending.start,pending.end);changeScheduleClock(input,pending.type,pending.text||'');return;
        }
        // Autofill/replacement events may not expose beforeinput data.
        const value=scheduleClockValue(input.value),caret=input.selectionStart??value.length,history=scheduleClockHistory.get(input);
        input.value=value;input.setSelectionRange(caret,caret);
        if(history&&history.items[history.index].value!==value){history.items=history.items.slice(0,history.index+1);history.items.push({value,caret});history.index++;}
        renderScheduleClock(input);updateScheduleTimePreview();
      });
    });
  }
  function updateScheduleTimePreview() {
    const exact=$('#scheduleTimeMode').value==='exact',result=scheduleTimeFormValue(),zone=$('#scheduleTimeZone').value.trim();
    $('#scheduleTimeExact').hidden=!exact;$('#scheduleTimeLabelField').hidden=exact;
    $('#scheduleTimeError').hidden=true;$('#scheduleTimeError').textContent='';
    ['#scheduleTimeStart','#scheduleTimeEnd'].forEach(id=>$(id).removeAttribute('aria-invalid'));
    $('#scheduleTimePreview').textContent=result.error?'':result.time+(zone?' · '+zone:'')+(result.overnight?' · 다음 날 종료':'');
  }
  function saveScheduleTime() {
    if(!body.classList.contains('editing')||!scheduleTimeTarget)return;
    const result=scheduleTimeFormValue();
    if(result.error){$('#scheduleTimeError').textContent=result.error;$('#scheduleTimeError').hidden=false;const input=$(result.field==='end'?'#scheduleTimeEnd':'#scheduleTimeStart');input.setAttribute('aria-invalid','true');input.focus();return;}
    const {panel}=scheduleTimeTarget;let {row}=scheduleTimeTarget;const isNew=!row,zone=$('#scheduleTimeZone').value.trim();
    if(!panel.isConnected||row&&!row.isConnected){closeScheduleTimeDialog();return;}
    if(isNew){row=document.createElement('div');row.className='timeline-row';row.dataset.rowId=uid('row');row.innerHTML='<div class="time" contenteditable="false"></div><div class="rail"><i class="dot"></i></div><article class="card"><h3 contenteditable="true"></h3><div class="remark" contenteditable="true"></div></article>';panel.appendChild(row);}
    const original=readScheduleTime(row);
    if(isNew||original.time!==result.time||original.zone!==zone){
      const parsed=parseTimetableTime(result.time),timeNode=row.querySelector('.time');
      if(parsed?.end!=null){const [,start,end]=result.time.match(/^(\d{1,2}:\d{2})(.*)$/);timeNode.innerHTML=escapeHtml(start)+'<span class="schedule-time-end">'+escapeHtml(end)+'</span>';}
      else timeNode.textContent=result.time;
      if(zone){const small=document.createElement('small');small.textContent=zone;timeNode.appendChild(small);}
    }
    closeScheduleTimeDialog();decorateScheduleRows();recordHistory();resetInactivityTimer();
    if(isNew)requestAnimationFrame(()=>focusAndSelect(row.querySelector('h3')));
  }
  function addScheduleWarning(row){const card=row?.querySelector('.card');if(!card)return;const warning=document.createElement('div');warning.className='schedule-warning';warning.innerHTML='<span class="schedule-warning-text" contenteditable="true"></span><button class="warning-delete" type="button">삭제</button>';card.insertBefore(warning,card.querySelector('.schedule-media-tools'));decorateEditablePlaceholders(card);warning.querySelector('.schedule-warning-text').focus();recordHistory();}
  function moveScheduleRow(row,direction){if(!body.classList.contains('editing')||!row)return;const panel=row.parentElement,rows=Array.from(panel.querySelectorAll(':scope > .timeline-row')),index=rows.indexOf(row),next=index+direction;if(index<0||next<0||next>=rows.length)return;if(direction<0)rows[next].before(row);else rows[next].after(row);updateScheduleMoveButtons();recordHistory();row.scrollIntoView({block:'nearest',behavior:prefersReducedMotion()?'auto':'smooth'});}




function decorateDates() {
    TRIP_DAYS.forEach((day,index)=>{
      const number=index+1,parts=configDateParts(day.date),head=$('.day'+number+' .day-head h2'),tab=$('label[for="d'+number+'"]');
      if(head) head.innerHTML=parts.month+'/'+parts.day+'<span>'+parts.weekday+' · DAY '+number+'</span>';
      if(tab) tab.innerHTML=parts.month+'/'+parts.day+'<span>'+parts.weekday.slice(0,1)+' · DAY '+number+'</span>';
    });
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
    documentSession.cancelHistory();recordHistory();
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
function bindScheduleControls(){
$('#addTimeBtn').onclick=addTimeRow;
document.addEventListener('click',event=>{if(isOperationBusy())return;
const media=event.target.closest('[data-media]');if(media&&body.classList.contains('editing')){selectActiveScheduleRow(media.closest('.timeline-row'));if(media.dataset.media==='time')openScheduleTimeDialog(media.closest('.timeline-row'));else if(media.dataset.media==='photo')$('#photoInput').click();else if(media.dataset.media==='map')openMapDialog(media.closest('.timeline-row'));else addScheduleWarning(media.closest('.timeline-row'));return;}
const rowMove=event.target.closest('[data-move-row]');if(rowMove&&!rowMove.disabled){moveScheduleRow(rowMove.closest('.timeline-row'),Number(rowMove.dataset.moveRow));return;}
if(event.target.closest('[data-delete-row]')&&body.classList.contains('editing')){event.target.closest('.timeline-row')?.remove();updateScheduleMoveButtons();recordHistory();return;}
if(event.target.classList.contains('warning-delete')&&body.classList.contains('editing')){event.target.closest('.schedule-warning')?.remove();recordHistory();return;}
});
$('#scheduleTimeCancel').onclick=closeScheduleTimeDialog;
$('#scheduleTimeSave').onclick=saveScheduleTime;
initializeScheduleClocks();
document.addEventListener('change',event=>{if(event.target.matches('.schedule-kind-select'))changeScheduleKind(event.target);});
document.addEventListener('input',event=>{const row=event.target.closest('.timeline-row');if(row&&event.target.closest('h3,.chip'))updateScheduleKindControl(row);});
$('#scheduleTimeDialog').addEventListener('input',updateScheduleTimePreview);
$('#scheduleTimeMode').onchange=updateScheduleTimePreview;
$('#scheduleTimeDialog').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&event.target.matches('input')){event.preventDefault();saveScheduleTime();}});
}



return Object.freeze({addTimeRow,closeScheduleTimeDialog,openScheduleTimeDialog,scheduleTimeFormValue,renderScheduleClock,setScheduleClock,changeScheduleClock,undoScheduleClock,initializeScheduleClocks,updateScheduleTimePreview,saveScheduleTime,addScheduleWarning,moveScheduleRow,decorateDates,decorateMapLink,updatePhotoMoveButtons,decoratePhotoFigure,updateScheduleMoveButtons,updateScheduleKindControl,changeScheduleKind,updateEditableEmpty,decorateEditablePlaceholders,decorateScheduleRows,bindScheduleControls});
}
