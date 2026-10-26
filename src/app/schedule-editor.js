  function addTimeRow(){const id=$('.day-radio:checked')?.id||'';if(!/^d\d+$/.test(id))return;openScheduleTimeDialog(null,$('.day'+id.slice(1)));}
  function closeScheduleTimeDialog(){$('#scheduleTimeDialog').hidden=true;scheduleTimeTarget=null;}
  function openScheduleTimeDialog(row,panel=row?.closest('.day')) {
    if(!body.classList.contains('editing')||!panel)return;
    clearTimeout(historyTimer);recordHistory();
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
  async function addCheckRow(){if($('.day-radio:checked')?.id!=='prep')return;await requireEditor('checklist',async()=>{await openChecklistEditor();addChecklistItem();});}
  function moveCheck(id,direction){if(!body.classList.contains('editing'))return;const labels=$$('.prepday .checklist label'),index=labels.findIndex(label=>label.dataset.checkId===id),next=index+direction;if(index<0||next<0||next>=labels.length)return;const label=labels[index],target=labels[next];if(direction<0)target.before(label);else target.after(label);updateChecklistMoveButtons();recordHistory();}
  function finishMutation(){if(body.classList.contains('editing'))recordHistory();else updateDirtyState();resetInactivityTimer();}
