  function parseTimetableTime(value) {
    const match=String(value||'').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(?:~|～|〜|–|—|-|부터)\s*(\d{1,2}):(\d{2})(?:\s*까지)?)?\s*$/);
    if(!match)return null;
    const start=Number(match[1])*60+Number(match[2]);
    if(Number(match[1])>23||Number(match[2])>59)return null;
    if(match[3]===undefined)return {start,end:null};
    const hour=Number(match[3]),minute=Number(match[4]);
    if(hour>24||minute>59||(hour===24&&minute!==0))return null;
    let end=hour*60+minute;
    if(end===start)return null;
    if(end<start)end+=1440;
    return {start,end};
  }
  function scheduleTimeValue({mode='exact',start='',end='',label=''}) {
    if(mode==='label')return {time:label.trim()||'미정',overnight:false};
    start=start.trim();end=end.trim();
    if(!start&&!end)return {time:'미정',overnight:false};
    if(!start)return {error:'종료 시간을 입력하려면 시작 시간도 입력해 주세요.',field:'start'};
    const parsedStart=parseTimetableTime(start);
    if(!parsedStart||parsedStart.end!==null)return {error:'시작 시간을 00:00~23:59 형식으로 입력해 주세요.',field:'start'};
    const clock=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
    const startText=clock(parsedStart.start);
    if(!end)return {time:startText,overnight:false};
    if(!/^\d{1,2}:\d{2}$/.test(end))return {error:'종료 시간을 00:00~24:00 형식으로 입력해 주세요.',field:'end'};
    const parsed=parseTimetableTime(startText+'~'+end);
    if(!parsed)return {error:'종료 시간은 시작과 달라야 하며, 00:00~24:00 범위여야 합니다.',field:'end'};
    const endMinutes=Number(end.split(':')[0])*60+Number(end.split(':')[1]);
    return {time:startText+'~'+clock(endMinutes),overnight:parsed.end>=1440};
  }
  function scheduleClockMask(value='') {
    const raw=String(value);
    if(/^[\d_]{2}:[\d_]{2}$/.test(raw))return raw;
    const digits=raw.replace(/\D/g,'').slice(0,4).padEnd(4,'_');
    return digits.slice(0,2)+':'+digits.slice(2);
  }
  function scheduleClockValue(value){const mask=scheduleClockMask(value);return /\d/.test(mask)?mask:'';}
  function editScheduleClock(value,start,end,type,text='') {
    const mask=scheduleClockMask(value).split(''),positions=[0,1,3,4];
    let caret=start;
    if(type==='insertText'){
      const raw=String(text).normalize('NFKC').trim();
      if(!/^\d+$/.test(raw)&&!/^\d{2}:\d{2}$/.test(raw))return {value:mask.join(''),caret};
      const digits=raw.replace(':',''),available=positions.filter(position=>position>=start);
      if(digits.length>available.length)return {value:mask.join(''),caret};
      positions.filter(position=>position>=start&&position<end).forEach(position=>mask[position]='_');
      digits.split('').forEach((digit,index)=>{const position=available[index];mask[position]=digit;caret=position===1?3:position+1;});
    }else if(type.startsWith('delete')){
      if(start!==end){positions.filter(position=>position>=start&&position<end).forEach(position=>mask[position]='_');caret=start===2?3:start;}
      else {const position=type==='deleteContentBackward'?positions.filter(position=>position<start).at(-1):positions.find(position=>position>=start);if(position!==undefined){mask[position]='_';caret=position;}}
    }
    return {value:mask.join(''),caret};
  }
  function scheduleKindMode(value){return ['activity','food','transit','stay','other'].includes(value)?value:'auto';}
  function timetableKind(title,chip='',selection='auto') {
    const manual=scheduleKindMode(selection);if(manual!=='auto')return manual;
    const text=title+' '+chip;
    if(/체크인|체크아웃|숙박|숙소|휴식|취침|HOTEL|AIRBNB/i.test(text)&&!/비행|기내/.test(title))return 'stay';
    if(/공항|비행|출국|귀국|출발|도착|이동|픽업|반납|렌터카|셔틀|탑승|귀로|FLIGHT|AIRPORT|ARRIVAL/i.test(text))return 'transit';
    if(/식사|점심|저녁|아침|브런치|카페|커피|바비큐|레스토랑|식당/.test(text))return 'food';
    if(/관람|관광|산책|투어|캐니언|미술관|박물관|해변|분수|공원|천문대|레이크|홀스슈|윈도우|루트 66|쇼|스피어|자유 일정/.test(text))return 'activity';
    return 'other';
  }
  function layoutTimetableEvents(events,{pixelsPerHour=64,minHeight=56}={}) {
    const items=events.map(event=>({...event,visualEnd:Math.max(event.end??event.start,event.start+minHeight/pixelsPerHour*60)})).sort((a,b)=>a.start-b.start||a.visualEnd-b.visualEnd);
    let group=[],groupEnd=-1;
    function finishGroup(){
      const laneEnds=[];
      group.forEach(item=>{let lane=laneEnds.findIndex(end=>end<=item.start);if(lane<0)lane=laneEnds.length;laneEnds[lane]=item.visualEnd;item.lane=lane;});
      group.forEach(item=>{item.lanes=laneEnds.length;item.conflict=item.end!==null&&group.some(other=>other!==item&&other.end!==null&&item.start<other.end&&other.start<item.end);});
    }
    items.forEach(item=>{if(item.start>=groupEnd){finishGroup();group=[];groupEnd=-1;}group.push(item);groupEnd=Math.max(groupEnd,item.visualEnd);});
    finishGroup();return items;
  }
  function timetableWindow(total,start,range) {
    const count=range==='all'?total:Math.min(total,1);
    const first=Math.min(Math.max(0,start),Math.max(0,total-count));
    return {start:first,count,end:first+count};
  }
  // End of pure timetable calculations.

  const TIMETABLE_KINDS={activity:'관광',food:'식사',transit:'이동',stay:'숙소·휴식',other:'기타'};
  function timetableClock(minutes){return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
  function timetableDate(index){const parts=configDateParts(TRIP_DAYS[index].date);return parts.month+'/'+parts.day;}
  function timetableZoneName(date){return new Intl.DateTimeFormat('en-US',{timeZone:DESTINATION_TIME_ZONE,timeZoneName:'short'}).formatToParts(new Date(date+'T12:00:00Z')).find(part=>part.type==='timeZoneName')?.value||DESTINATION_TIME_ZONE;}
  function readScheduleTime(row) {
    const timeNode=row?.querySelector('.time')?.cloneNode(true),smallZone=timeNode?.querySelector('small')?.textContent.trim()||'';
    timeNode?.querySelectorAll('small').forEach(node=>node.remove());
    let time=timeNode?.textContent.replace(/\s+/g,' ').trim()||'미정',zone=smallZone;
    const suffix=time.match(/\s*(KST|PST|PDT|MST|MDT|EST|EDT|UTC|GMT(?:[+-]\d{1,2}(?::\d{2})?)?)$/i);
    if(suffix){zone=zone||suffix[1].toUpperCase();time=time.slice(0,suffix.index).trim();}
    return {time,zone};
  }
  function readTimetableDays() {
    const days=TRIP_DAYS.map((day,dayIndex)=>{
      const panel=$('main .day'+(dayIndex+1)),zoneName=timetableZoneName(day.date);
      const events=Array.from(panel?.querySelectorAll('.timeline-row')||[]).map((row,rowIndex)=>{
        const {time,zone}=readScheduleTime(row);
        const title=row.querySelector('h3')?.textContent.trim()||'제목 없음',parsed=parseTimetableTime(time),foreign=Boolean(zone&&zone!==zoneName&&zone!==DESTINATION_TIME_ZONE);
        return {key:dayIndex+':'+rowIndex,sourceDay:dayIndex,row,title,time,zone,foreign,kind:timetableKind(title,row.querySelector('.chip')?.textContent||'',row.dataset.scheduleKind),start:parsed?.start??null,end:parsed?.end??null,loose:!parsed||foreign,continuation:false};
      });
      return {index:dayIndex,date:day.date,subtitle:panel?.querySelector('.day-head p')?.textContent.trim()||'',events,timed:[],loose:events.filter(event=>event.loose)};
    });
    days.forEach(day=>day.events.filter(event=>!event.loose).forEach(event=>{
      day.timed.push({...event,end:event.end===null?null:Math.min(1440,event.end)});
      if(event.end>1440){const nextDate=new Date(Date.parse(day.date+'T00:00:00Z')+86400000).toISOString().slice(0,10),next=days.find(item=>item.date===nextDate);if(next)next.timed.push({...event,start:0,end:event.end-1440,continuation:true});}
    }));
    return days;
  }
  function timetableEventButton(event,{position='',compact=false,overview=false}={}) {
    const kind=TIMETABLE_KINDS[event.kind],timing=(event.continuation?'전날부터 · ':'')+event.time+(event.zone?' '+event.zone:''),note=event.foreign?'다른 시간대':event.start===null?'시간 미정·종일':event.end===null?'종료 미정':event.conflict?'시간 겹침':'';
    const label=timetableDate(event.sourceDay)+' · '+timing+' · '+event.title+' · '+kind+(note?' · '+note:'');
    return '<button type="button" class="tt-event tt-kind-'+event.kind+(event.end===null&&!event.loose?' tt-point':'')+(compact?' tt-short':'')+(overview?' tt-overview-event':'')+'" data-tt-event="'+event.key+'" aria-haspopup="dialog" aria-label="'+escapeHtml(label)+'" title="'+escapeHtml(label)+'"'+(position?' style="'+position+'"':'')+'><small>'+escapeHtml(timing)+'</small><strong>'+escapeHtml(event.title)+'</strong>'+(!compact&&note?'<span class="tt-event-note">'+escapeHtml(note)+'</span>':'')+'</button>';
  }
  function renderTimetableOverview(days,startHour,fittedHeight=null) {
    const narrow=window.matchMedia('(max-width:800px)').matches,height=narrow?(24-startHour)*48:fittedHeight??Math.round(Math.max(180,Math.min(420,window.innerHeight*.45))),minutes=(24-startHour)*60,pixelsPerHour=height/(24-startHour),minHeight=narrow?44:20;
    const dayLabel=day=>timetableDate(day.index)+' · DAY '+(day.index+1)+' · '+day.events.length+'개 일정 · 1일 보기 열기';
    let content='<div class="tt-overview-corner">날짜</div>'+days.map(day=>{
      const parts=configDateParts(day.date);
      return '<button type="button" class="tt-overview-day" data-tt-open-day="'+day.index+'" aria-label="'+escapeHtml(dayLabel(day))+'" title="'+escapeHtml(day.subtitle+' · '+dayLabel(day))+'"><strong>'+escapeHtml(timetableDate(day.index))+'</strong><small>'+escapeHtml(parts.weekday.slice(0,1))+' · D'+(day.index+1)+'</small><p>'+escapeHtml(day.subtitle)+'</p></button>';
    }).join('');
    content+='<div class="tt-overview-corner">별도</div>'+days.map(day=>{
      if(!day.loose.length)return '<div class="tt-overview-loose-empty" aria-label="'+escapeHtml(timetableDate(day.index)+' 별도 일정 없음')+'"></div>';
      const label=timetableDate(day.index)+' 시간 미정·종일·다른 시간대 '+day.loose.length+'개 · 1일 보기 열기';
      const items=day.loose.slice(0,2).map(event=>'<span class="tt-overview-loose-item tt-kind-'+event.kind+'" title="'+escapeHtml(event.time+' '+event.zone+' · '+event.title)+'">'+escapeHtml(event.time+(event.zone?' '+event.zone:'')+' · '+event.title)+'</span>').join('')+(day.loose.length>2?'<span class="tt-overview-loose-more">+'+(day.loose.length-2)+'개 더 보기</span>':'');
      return '<button type="button" class="tt-overview-loose" data-tt-open-day="'+day.index+'" aria-label="'+escapeHtml(label)+'">'+items+'</button>';
    }).join('');
    const hours=[];for(let hour=startHour;hour<=24;hour++)if(hour===startHour||hour===24||(hour%2===0&&hour-startHour>=2))hours.push(hour);
    const axis=hours.map(hour=>'<span style="top:'+((hour-startHour)*60/minutes*height)+'px">'+String(hour).padStart(2,'0')+'</span>').join('');
    const lines=hours.map(hour=>'<i class="tt-overview-line" aria-hidden="true" style="top:'+((hour-startHour)*60/minutes*height)+'px"></i>').join('');
    content+='<div class="tt-overview-axis" aria-hidden="true">'+axis+'</div>'+days.map(day=>{
      const events=layoutTimetableEvents(day.timed,{pixelsPerHour,minHeight}).map(event=>{
        const top=(event.start-startHour*60)/minutes*height,blockHeight=Math.max(minHeight,((event.end??event.start)-event.start)/60*pixelsPerHour-2);
        const position='top:'+top+'px;height:'+blockHeight+'px;left:calc('+event.lane/event.lanes*100+'% + 2px);width:calc('+100/event.lanes+'% - 4px)';
        return timetableEventButton(event,{position,compact:true,overview:true});
      }).join('');
      const empty=events?'':'<span class="tt-overview-empty">'+(day.loose.length?'상단 일정<br>확인':'일정 없음')+'</span>';
      return '<div class="tt-overview-column" role="group" aria-label="'+escapeHtml(timetableDate(day.index)+' 시간 일정 요약')+'">'+lines+events+empty+'</div>';
    }).join('');
    content+='<div class="tt-overview-corner">일정</div>'+days.map(day=>'<div class="tt-overview-count"><b>'+day.events.length+'개</b><span>시간 '+day.timed.length+' · 별도 '+day.loose.length+'</span></div>').join('');
    const grid=$('#timetableOverviewGrid');grid.style.setProperty('--tt-days',String(days.length));grid.style.setProperty('--tt-overview-height',height+'px');grid.innerHTML=content;
    $('#timetableOverviewHelp').textContent='점선: 종료 시간 미정';
    if(!narrow&&fittedHeight===null){const fixedHeight=$('#timetableView').getBoundingClientRect().height-height,available=window.innerHeight-$('.tabs').getBoundingClientRect().height-24,target=Math.floor(Math.max(180,Math.min(420,available-fixedHeight)));if(target!==height)renderTimetableOverview(days,startHour,target);}
  }
  function renderTimetable({resetScroll=false}={}) {
    if(!timetableActive)return;
    const scroller=$('#timetableScroll');if(!scroller.hidden)timetableDayScrollTop=scroller.scrollTop;
    timetableDays=readTimetableDays();
    const range=timetableWindow(timetableDays.length,timetableStart,timetableRange);if(timetableRange!=='all')timetableStart=range.start;
    const days=timetableDays.slice(range.start,range.end),timed=days.flatMap(day=>day.timed),startHour=Math.min(6,...timed.map(event=>Math.floor(event.start/60))),endHour=24,hourHeight=64,height=(endHour-startHour)*hourHeight;
    $('#timetableZone').textContent=DESTINATION_REFERENCE_LABEL+' 시간축 · '+DESTINATION_TIME_ZONE+' · 보기 전용';
    $('#timetableStart').innerHTML=timetableDays.map(day=>'<option value="'+day.index+'"'+(day.index===range.start?' selected':'')+'>'+escapeHtml(timetableDate(day.index)+' · DAY '+(day.index+1))+'</option>').join('');
    $('#timetableView .tt-nav').hidden=timetableRange==='all';$('#timetableStart').disabled=timetableRange==='all';$('#timetablePrev').disabled=range.start===0;$('#timetableNext').disabled=range.end>=timetableDays.length;
    $$('#timetableView [data-tt-range]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.ttRange===timetableRange)));
    const eventCount=days.reduce((sum,day)=>sum+day.events.length,0),looseCount=days.reduce((sum,day)=>sum+day.loose.length,0);
    $('#timetableSummary').textContent=timetableDate(range.start)+' ~ '+timetableDate(range.end-1)+' · '+eventCount+'개 일정'+(looseCount?' · 상단 별도 표시 '+looseCount+'개':'');
    const overview=timetableRange==='all';
    $('#timetableOverview').hidden=!overview;scroller.hidden=overview;$('#timetableHelp').hidden=overview;
    if(overview){renderTimetableOverview(days,startHour);return;}
    let content='<div class="tt-corner">시간</div>'+days.map(day=>'<div class="tt-day-header"><strong>'+escapeHtml(timetableDate(day.index))+' <small>'+escapeHtml(configDateParts(day.date).weekday.slice(0,1))+' · D'+(day.index+1)+'</small></strong><p>'+escapeHtml(day.subtitle)+'</p></div>').join('');
    content+='<div class="tt-loose-label">시간<br>미정<br>·<br>별도</div>'+days.map(day=>'<div class="tt-loose">'+(day.loose.length?'<details open><summary>미정·종일·다른 시간대 '+day.loose.length+'개</summary><div class="tt-loose-list">'+day.loose.map(event=>timetableEventButton(event)).join('')+'</div></details>':'<p>별도 일정 없음</p>')+'</div>').join('');
    let axis='';for(let hour=startHour;hour<=endHour;hour++)axis+='<span style="top:'+((hour-startHour)*hourHeight)+'px">'+timetableClock(hour*60)+'</span>';
    content+='<div class="tt-axis" style="height:'+(height+58)+'px" aria-hidden="true">'+axis+'</div>'+days.map(day=>{
      const events=layoutTimetableEvents(day.timed).map(event=>{
        const top=(event.start-startHour*60)/60*hourHeight,blockHeight=Math.max(56,((event.end??event.start)-event.start)/60*hourHeight-3);
        const position='top:'+top+'px;height:'+blockHeight+'px;left:calc('+event.lane/event.lanes*100+'% + 4px);width:calc('+100/event.lanes+'% - 8px)';
        return timetableEventButton(event,{position,compact:blockHeight<82});
      }).join('');
      return '<div class="tt-day-column" role="group" aria-label="'+escapeHtml(timetableDate(day.index)+' 시간 일정')+'" style="height:'+(height+58)+'px">'+(events||'<span class="tt-empty-day">'+(day.loose.length?'시간 지정 일정 없음<br>상단 일정을 확인하세요.':'등록된 일정 없음')+'</span>')+'</div>';
    }).join('');
    content+='<div class="tt-footer-label">하루<br>요약</div>'+days.map(day=>{
      const stays=day.events.filter(event=>/체크인|숙박/.test(event.title)),moves=day.events.filter(event=>event.kind==='transit'),known=moves.filter(event=>event.start!==null&&event.end!==null),minutes=known.reduce((sum,event)=>sum+event.end-event.start,0),hours=Math.floor(minutes/60),remainder=minutes%60;
      const movement=moves.length?'이동 '+moves.length+'건 · '+(known.length===moves.length?(hours?hours+'시간 ':'')+(remainder?remainder+'분':''):known.length?'입력된 구간 '+minutes+'분 · 나머지 미정':'소요시간 미정'):'등록된 이동 없음';
      return '<div class="tt-day-footer">'+(stays.length?'체크인·숙박<b>'+stays.map(event=>escapeHtml(event.title)).join('<br>')+'</b>':'체크인·숙박 기록 없음')+'<span>'+escapeHtml(movement)+'</span></div>';
    }).join('');
    $('#timetableGrid').style.setProperty('--tt-days',String(days.length));$('#timetableGrid').innerHTML=content;
    scroller.scrollTop=resetScroll?0:timetableDayScrollTop;
  }
  function setScheduleView(mode) {
    timetableActive=mode==='timetable'&&!body.classList.contains('editing');
    if(timetableActive){const selected=$('.day-radio:checked')?.id||'';if(/^d\d+$/.test(selected))timetableStart=Number(selected.slice(1))-1;}
    syncScheduleView();
  }
  function syncScheduleView() {
    if(body.classList.contains('editing'))timetableActive=false;
    const schedule=/^d\d+$/.test($('.day-radio:checked')?.id||''),showTimetable=schedule&&timetableActive;
    body.classList.toggle('timetable-active',showTimetable);$('main').hidden=showTimetable;$('#timetableView').hidden=!showTimetable;
    $('.tabs').hidden=!schedule;$('#scheduleViewSwitch').hidden=!schedule;
    $('#listViewBtn').setAttribute('aria-pressed',String(!timetableActive));$('#timetableViewBtn').setAttribute('aria-pressed',String(timetableActive));$('#timetableViewBtn').disabled=body.classList.contains('editing');
    $('#scheduleViewHint').hidden=!body.classList.contains('editing');
    $('#scheduleViewHint').textContent=body.classList.contains('editing')?'편집 완료 후 시간표 보기':'';
    renderTimetable();
  }
  function openTimetableDetail(key) {
    const event=timetableDays.flatMap(day=>day.events).find(item=>item.key===key);if(!event)return;
    const card=event.row.querySelector('.card')?.cloneNode(true);if(!card)return;
    stripTransient(card);card.querySelector('h3')?.remove();card.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
    $('#timetableDetailTitle').textContent=event.title;
    $('#timetableDetailMeta').textContent=timetableDate(event.sourceDay)+' · DAY '+(event.sourceDay+1)+' · '+TIMETABLE_KINDS[event.kind];
    $('#timetableDetailTiming').textContent=event.time+' · '+(event.zone||timetableZoneName(TRIP_DAYS[event.sourceDay].date))+(event.end===null&&event.start!==null?' · 종료 시각 미정':'')+(event.end>1440?' · 다음 날까지':'')+(event.foreign?' · 시간축과 다른 시간대로, 입력된 원래 시각입니다.':'');
    $('#timetableDetailContent').replaceChildren(card);$('#timetableDetail').hidden=false;
  }
  function initializeTimetable() {
    $('#listViewBtn').onclick=()=>setScheduleView('list');$('#timetableViewBtn').onclick=()=>setScheduleView('timetable');
    $('#timetableView').addEventListener('click',event=>{
      const day=event.target.closest('[data-tt-open-day]');if(day){timetableStart=Number(day.dataset.ttOpenDay);timetableRange='1';renderTimetable({resetScroll:true});$('#timetableStart').focus({preventScroll:true});return;}
      const range=event.target.closest('[data-tt-range]');if(range){timetableRange=range.dataset.ttRange;renderTimetable({resetScroll:true});return;}
      const item=event.target.closest('[data-tt-event]');if(item)openTimetableDetail(item.dataset.ttEvent);
    });
    $('#timetablePrev').onclick=()=>{timetableStart--;renderTimetable({resetScroll:true});};
    $('#timetableNext').onclick=()=>{timetableStart++;renderTimetable({resetScroll:true});};
    $('#timetableStart').onchange=event=>{timetableStart=Number(event.target.value);renderTimetable({resetScroll:true});};
    $('#timetableDetailClose').onclick=()=>{$('#timetableDetail').hidden=true;};
    window.addEventListener('beforeprint',()=>{$('main').hidden=false;});
    window.addEventListener('afterprint',syncScheduleView);
    window.addEventListener('resize',()=>{if(!timetableActive||timetableRange!=='all')return;cancelAnimationFrame(timetableOverviewResizeFrame);timetableOverviewResizeFrame=requestAnimationFrame(()=>renderTimetable());});
    document.addEventListener('change',event=>{if(!event.target.matches('.day-radio')||!timetableActive)return;if(/^d\d+$/.test(event.target.id)){timetableStart=Number(event.target.id.slice(1))-1;renderTimetable({resetScroll:true});}});
  }
