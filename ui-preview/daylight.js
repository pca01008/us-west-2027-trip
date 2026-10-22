// A-only interaction design. All changes stay in memory; no production API calls.
const daylightKinds = {activity:'관광', food:'식사', transit:'이동', stay:'숙소·휴식', other:'기타'};
function daylightArrow() { return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>'; }
function daylightWarnings(event) {
  return event.warnings.length ? `<section class="event-warnings" aria-label="확인할 사항"><h4>${icon('alert')} 확인할 사항</h4><ul>${event.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></section>` : '';
}
function daylightTools() {
  const button=(name,label,primary=false)=>`<button type="button" class="tool-action ${primary?'tool-primary':''}" disabled>${icon(name)}<span>${label}</span></button>`;
  return `<details class="more daylight-tools"><summary aria-label="설정">${icon('settings')}<span>설정</span></summary><div class="more-menu"><h2>여행 설정</h2><p id="tools-preview-note">배치 미리보기 · 아래 기능은 연결 전입니다.</p><div class="tool-group" role="group" aria-label="편집과 저장" aria-describedby="tools-preview-note"><h3>편집과 저장</h3>${button('edit',state.tab==='prep'?'목록 편집':state.tab==='ledger'?'가계부 설정':'편집 시작',true)}${button('save','변경사항 저장')}${button('history','버전 관리')}</div><div class="tool-group" role="group" aria-label="파일"><h3>파일</h3>${button('upload','편집본 불러오기')}${button('export','내보내기')}</div><div class="tool-group" role="group" aria-label="화면"><h3>화면</h3>${button('settings','화면 테마')}</div><button class="tools-close" type="button" data-close-tools>닫기</button></div></details>`;
}
function daylightViewSwitch() {
  return `<div class="schedule-toolbar"><div class="schedule-modes" role="group" aria-label="일정 보기 방식">${[['list','일별 일정'],['timetable','시간표']].map(([key,label])=>`<button data-view="${key}" aria-pressed="${state.view===key}">${daylightViewIcon(key)}<span>${label}</span></button>`).join('')}</div></div>`;
}
function daylightViewIcon(name) {
  const paths=name==='list'?'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11"/>';
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
function daylightExpenseRow(expense) {
  const kind=({'교통':'transit','식비':'food','숙박':'stay'})[expense.category]||'other';
  return `<div class="expense-row daylight-expense"><span class="expense-date">${esc(expense.date)}</span><strong class="expense-title">${esc(expense.title)}</strong><span class="expense-category"><span class="category-label kind-${kind}">${esc(expense.category)}</span></span><strong class="expense-amount">$${expense.amount.toFixed(2)}</strong></div>`;
}
function daylightDays() {
  const days=trip.days.map((day,index)=>{
    const zone=new Intl.DateTimeFormat('en-US',{timeZone:trip.timeZone,timeZoneName:'short'}).formatToParts(new Date(day.date+'T12:00:00Z')).find(p=>p.type==='timeZoneName').value;
    const events=day.events.map((event,row)=>{
      const parsed=parseTimetableTime(event.time),foreign=Boolean(event.zone&&event.zone!==zone&&event.zone!==trip.timeZone);
      return {...event,key:`${index}:${row}`,sourceDay:index,kind:timetableKind(event.title,event.chip,event.kind),start:parsed?.start??null,end:parsed?.end??null,loose:!parsed||foreign,foreign};
    });
    return {...day,index,events,loose:events.filter(e=>e.loose),timed:[]};
  });
  days.forEach(day=>day.events.filter(e=>!e.loose).forEach(event=>{
    day.timed.push({...event,end:event.end===null?null:Math.min(1440,event.end)});
    if(event.end>1440){
      const date=new Date(Date.parse(day.date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
      days.find(d=>d.date===date)?.timed.push({...event,start:0,end:event.end-1440,continuation:true});
    }
  }));
  return days;
}
function daylightEvent(event,position='') {
  const timing=`${event.continuation?'전날부터 · ':''}${event.time} ${event.zone}`.trim();
  const note=event.foreign?'다른 시간대':event.start===null?'시간 미정·종일':event.end===null?'종료 미정':event.conflict?'시간 겹침':'';
  const label=`${dayLabel(trip.days[event.sourceDay])} · ${timing} · ${event.title} · ${daylightKinds[event.kind]}${note?' · '+note:''}`;
  return `<button class="dt-event kind-${event.kind} ${event.end===null&&!event.loose?'dt-point':''}" data-event="${event.key}" aria-haspopup="dialog" aria-label="${esc(label)}" title="${esc(label)}" ${position?`style="${position}"`:''}><time>${esc(timing)}</time><strong>${esc(event.title)}</strong></button>`;
}
function daylightTimetable() {
  const all=state.range==='all',days=daylightDays(),shown=all?days:[days[state.day]];
  const startHour=Math.min(6,...shown.flatMap(d=>d.timed).map(e=>Math.floor(e.start/60)));
  const narrow=matchMedia('(max-width:800px)').matches,pixelsPerHour=all&&!narrow?Math.max(220,Math.min(420,innerHeight-650))/(24-startHour):64,minHeight=all&&!narrow?32:56;
  const height=(24-startHour)*pixelsPerHour;
  const hours=Array.from({length:25-startHour},(_,i)=>startHour+i).filter(h=>!all||h%2===0||h===startHour);
  const lines=hours.map(h=>`<i aria-hidden="true" style="top:${(h-startHour)*pixelsPerHour}px"></i>`).join('');
  const headers=shown.map(d=>`<button class="dt-day" data-open-day="${d.index}" aria-label="${dayLabel(d)} 1일 보기"><strong>${Number(d.date.slice(5,7))}/${Number(d.date.slice(8))} ${shortDay(d)}</strong><span>${esc(city(d.index))}</span></button>`).join('');
  const loose=shown.map(d=>`<div class="dt-loose">${d.loose.length?(all?`<button data-open-day="${d.index}" aria-label="${dayLabel(d)} 별도 일정 ${d.loose.length}개 보기">${d.loose.slice(0,2).map(e=>`<span>${esc(e.time+' '+e.zone)} · ${esc(e.title)}</span>`).join('')}${d.loose.length>2?`<strong>+${d.loose.length-2}개 더 보기</strong>`:''}</button>`:d.loose.map(e=>daylightEvent(e)).join('')):'<span>없음</span>'}</div>`).join('');
  const axis=hours.map(h=>`<span style="top:${(h-startHour)*pixelsPerHour}px">${String(h).padStart(2,'0')}:00</span>`).join('');
  const columns=shown.map(d=>`<div class="dt-column" role="group" aria-label="${dayLabel(d)} 시간 일정">${lines}${layoutTimetableEvents(d.timed,{pixelsPerHour,minHeight}).map(e=>daylightEvent(e,`top:${(e.start-startHour*60)/60*pixelsPerHour}px;height:${Math.max(minHeight,((e.end??e.start)-e.start)/60*pixelsPerHour-2)}px;left:calc(${e.lane/e.lanes*100}% + 2px);width:calc(${100/e.lanes}% - 4px)`)).join('')}${!d.timed.length?'<p class="dt-empty">'+(d.loose.length?'상단 일정 확인':'일정 없음')+'</p>':''}</div>`).join('');
  return `<section class="daylight-timetable" aria-label="여행 시간표"><div class="dt-toolbar"><div><h2>${all?'전체 일정 한눈에 보기':dayLabel(trip.days[state.day])}</h2><p>미국 서부 시간축 · 보기 전용</p></div><div class="view-switch" role="group" aria-label="시간표 표시 범위"><button data-range="1" aria-pressed="${!all}">1일</button><button data-range="all" aria-pressed="${all}">전체</button></div></div>${!all?dates():''}<div class="dt-legend" aria-label="일정 종류">${Object.entries(daylightKinds).map(([key,label])=>`<span class="kind-${key}"><i></i>${label}</span>`).join('')}</div><p class="dt-scroll-hint">좌우로 넘겨 날짜 보기 ${daylightArrow()}</p><div class="dt-scroll ${all?'dt-all':'dt-single'}" tabindex="0" role="region" aria-label="${all?'전체':'1일'} 시간표"><div class="dt-grid" style="--days:${shown.length};--axis-height:${height+minHeight}px"><div class="dt-corner">날짜</div>${headers}<div class="dt-corner">미정<br>· 별도</div>${loose}<div class="dt-axis">${axis}</div>${columns}</div></div><p class="dt-help">점선: 종료 시간 미정 · 미정·종일·다른 시간대 일정은 상단에 표시</p>${!all?daylightDaySummary(shown[0]):''}</section><dialog id="daylight-detail" aria-labelledby="daylight-detail-title"><div class="detail-heading"><h2 id="daylight-detail-title"></h2><button class="secondary-button" data-close-detail autofocus>닫기</button></div><div id="daylight-detail-body"></div></dialog>`;
}
function daylightDaySummary(day) {
  const stays=day.events.filter(e=>/체크인|숙박/.test(e.title)),moves=day.events.filter(e=>e.kind==='transit'),known=moves.filter(e=>e.start!==null&&e.end!==null);
  const minutes=known.reduce((sum,e)=>sum+e.end-e.start,0);
  return `<div class="dt-day-summary"><p>${stays.length?'체크인·숙박: '+stays.map(e=>esc(e.title)).join(' · '):'체크인·숙박 기록 없음'}</p><p>${moves.length?`이동 ${moves.length}건 · ${known.length?`입력된 구간 ${minutes}분${known.length<moves.length?' · 나머지 미정':''}`:'소요시간 미정'}`:'등록된 이동 없음'}</p></div>`;
}
function bindDaylight() {
  const rerenderFocus=selector=>{render();document.querySelector(selector)?.focus({preventScroll:true});};
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;rerenderFocus(`[data-view="${state.view}"]`);}));
  document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{state.range=b.dataset.range;rerenderFocus(`[data-range="${state.range}"]`);}));
  document.querySelectorAll('[data-open-day]').forEach(b=>b.addEventListener('click',()=>{state.day=Number(b.dataset.openDay);state.range='1';rerenderFocus('[data-range="1"]');}));
  const details=document.querySelector('.daylight-tools');
  document.querySelector('[data-close-tools]')?.addEventListener('click',()=>{details.open=false;details.querySelector('summary').focus();});
  details?.addEventListener('keydown',e=>{if(e.key==='Escape'){details.open=false;details.querySelector('summary').focus();}});
  // Assign instead of accumulating listeners across the prototype's full renders.
  document.onclick=e=>{if(details?.open&&!details.contains(e.target))details.open=false;};
  const dialog=document.getElementById('daylight-detail');
  document.querySelectorAll('[data-event]').forEach(button=>button.addEventListener('click',()=>{
    const [day,index]=button.dataset.event.split(':').map(Number),event=trip.days[day].events[index];
    document.getElementById('daylight-detail-title').textContent=event.title;
    document.getElementById('daylight-detail-body').innerHTML=`<p class="detail-time">${dayLabel(trip.days[day])} · ${esc(event.time)} ${esc(event.zone)}</p><p>${esc(event.detail)}</p>${daylightWarnings(event)}${event.map?`<a class="text-link" href="${esc(event.map.url)}" target="_blank" rel="noopener noreferrer">${icon('map')} ${esc(event.map.name||'지도 열기')}</a>`:''}${(event.photos||[]).map(p=>`<figure><img src="${esc(p.src)}" alt="${esc(p.alt)}"></figure>`).join('')}`;
    dialog.showModal();
  }));
  document.querySelector('[data-close-detail]')?.addEventListener('click',()=>dialog.close());
  const scroller=document.querySelector('.dt-single'),first=document.querySelector('.dt-single .dt-column .dt-event');
  if(scroller&&first) scroller.scrollTop=parseFloat(first.style.top);
}
// Recalculate the compact overview only when crossing its layout breakpoint.
matchMedia('(max-width:800px)').addEventListener('change',()=>{if(state.tab==='schedule'&&state.view==='timetable')render();});
