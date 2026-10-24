  function dateKeyNumber(dateKey) { return Date.parse(dateKey+'T00:00:00Z')/86400000; }
  function zonedDateNumber(timestamp,timeZone) { return dateKeyNumber(zonedDateKey(timestamp,timeZone)); }
  function updateTripProgress() {
    const now = Number.isFinite(PREVIEW_NOW) ? PREVIEW_NOW : Date.now();
    const label = $('#tripProgressLabel');
    const meta = $('#tripProgressMeta');
    const fill = $('#tripProgressFill');
    const track = $('.trip-progress-track');
    let percent = 0;
    if (now < TRIP_START) {
      const days = Math.max(0, zonedDateNumber(TRIP_START,HOME_TIME_ZONE) - zonedDateNumber(now,HOME_TIME_ZONE));
      label.textContent = days === 0 ? 'D-DAY' : 'D-' + days;
      meta.textContent = CONFIG.progress?.before||'여행 시작까지';
    } else if (now <= TRIP_END) {
      percent = Math.min(100, Math.max(0, (now-TRIP_START)/(TRIP_END-TRIP_START)*100));
      label.textContent = Math.round(percent) + '% 진행';
      meta.textContent = CONFIG.progress?.during||'여행 중';
    } else {
      percent = 100;
      const days = Math.max(0, zonedDateNumber(now,HOME_TIME_ZONE) - zonedDateNumber(TRIP_END,HOME_TIME_ZONE));
      label.textContent = days === 0 ? '여행 종료 D-DAY' : '여행 종료 D+' + days;
      meta.textContent = CONFIG.progress?.after||'여행 완료';
    }
    fill.style.width = percent + '%';
    track?.setAttribute('aria-valuenow', String(Math.round(percent)));
  }

  function zonedParts(timestamp,timeZone) {
    const formatter=new Intl.DateTimeFormat('ko-KR',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    return Object.fromEntries(formatter.formatToParts(new Date(timestamp)).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  }
  function zonedDateKey(timestamp,timeZone) {
    const parts=zonedParts(timestamp,timeZone);
    return parts.year+'-'+parts.month+'-'+parts.day;
  }
  function timeZoneOffsetMinutes(timestamp,timeZone) {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp));
    const values=Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
    return Math.round((Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute),Number(values.second))-timestamp)/60000);
  }
  function updateWorldClocks() {
    const now=Number.isFinite(PREVIEW_NOW)?PREVIEW_NOW:Date.now(),home=zonedParts(now,HOME_TIME_ZONE),destination=zonedParts(now,DESTINATION_TIME_ZONE);
    $('#homeClock').textContent=home.hour+':'+home.minute;$('#destinationClock').textContent=destination.hour+':'+destination.minute;
    $('#homeDate').textContent=home.month+'.'+home.day+' '+home.weekday;$('#destinationDate').textContent=destination.month+'.'+destination.day+' '+destination.weekday;
    const difference=timeZoneOffsetMinutes(now,HOME_TIME_ZONE)-timeZoneOffsetMinutes(now,DESTINATION_TIME_ZONE),absolute=Math.abs(difference),hours=Math.floor(absolute/60),minutes=absolute%60,amount=(hours?hours+'시간':'')+(minutes?' '+minutes+'분':'');
    $('#timeGap').innerHTML=difference===0?configEscape(DESTINATION_REFERENCE_LABEL)+'와 '+configEscape(HOME_REFERENCE_LABEL)+'의 시차 없음':configEscape(DESTINATION_REFERENCE_LABEL)+'는 '+configEscape(HOME_REFERENCE_LABEL)+'보다 <b>'+amount+(difference>0?' 느림':' 빠름')+'</b>';
  }
  function selectInitialTab() {
    const now=Number.isFinite(PREVIEW_NOW)?PREVIEW_NOW:Date.now(),dateKey=zonedDateKey(now,VISITOR_TIME_ZONE);
    let target='prep';
    if(dateKey>TRIP_LAST_DATE)target='money';
    else if(dateKey>=TRIP_FIRST_DATE){let dayIndex=TRIP_DAYS.findIndex(day=>day.date===dateKey);if(dayIndex<0){dayIndex=0;TRIP_DAYS.forEach((day,index)=>{if(day.date<=dateKey)dayIndex=index;});}target='d'+(dayIndex+1);}
    const radio=document.getElementById(target);if(radio)radio.checked=true;
    if(/^d\d+$/.test(target))lastScheduleDay=target;
  }
