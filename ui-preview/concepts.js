const variant = document.body.dataset.concept;
const trip = window.DEMO_TRIP;
const names = {a:'Daylight',b:'Postcard',c:'Trip Desk'};
const state = {tab:'schedule', day:4, checked:new Set([0,1,3,4]), expenseFilter:'all', view:'list', range:matchMedia('(max-width:640px)').matches?'1':'all'};
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${window.UI_ICONS[name] || window.UI_ICONS.map}</svg>`;
const dayLabel = day => new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'UTC'}).format(new Date(day.date+'T12:00:00Z'));
const shortDay = day => new Intl.DateTimeFormat('ko-KR',{weekday:'short',timeZone:'UTC'}).format(new Date(day.date+'T12:00:00Z'));
const city = index => index < 1 ? '라스베이거스' : index < 3 ? '캐니언 투어' : index < 4 ? '라스베이거스' : index === 4 ? '라스베이거스 → LA' : index < 9 ? '로스앤젤레스' : index === 9 ? '귀국 비행' : '인천';
function nav(className='main-nav') {
  return `<nav class="${className}" aria-label="주 메뉴">${[['schedule','map','일정'],['prep','check','준비'],['ledger','save','가계부']].map(([id,i,label])=>`<button data-tab="${id}" aria-pressed="${state.tab===id}">${icon(i)}<span>${label}</span></button>`).join('')}</nav>`;
}
function dates() {
  return `<nav class="date-strip" aria-label="여행 날짜">${trip.days.map((day,i)=>`<button data-day="${i}" aria-label="${dayLabel(day)}" aria-pressed="${i===state.day}"><span>${shortDay(day)}</span><strong>${Number(day.date.slice(-2))}</strong></button>`).join('')}</nav>`;
}
function notice() { return `<div class="demo-banner"><a href="index.html" target="_top">${variant.toUpperCase()} · ${names[variant]} <span> / 초안 비교</span></a><span>디자인 초안 · 예시 상태</span></div>`; }
function more() {
  if(variant==='a') return daylightTools();
  return `<details class="more"><summary aria-label="여행 도구">${icon('settings')}<span>도구</span></summary><div class="more-menu"><p>선택 후 연결할 기능</p><span>편집 · 저장 · 버전 관리</span><span>내보내기 · 테마</span><p>이번 초안은 화면 비교용입니다.</p></div></details>`;
}
function heading(title,subtitle,action='') {return `<div class="section-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;}
function lodgings() {
  return `<section class="stay"><img src="../assets/airbnb.webp" alt="West Hollywood 숙소 외관"><div class="stay-copy"><span class="small-label">LA에서 머무는 곳</span><h3>West Hollywood</h3><p>Airbnb · 1월 25일–29일</p><a class="text-link" href="https://www.google.com/maps/search/?api=1&query=6259%20Del%20Valle%20Drive%20West%20Hollywood%20CA%2090048" target="_blank" rel="noopener noreferrer">${icon('map')} 지도 열기</a></div></section>`;
}
function prepMini() {
  return `<section class="prep-mini"><div class="small-heading"><h3>출발 전 준비</h3><span>${state.checked.size} / ${trip.prep.length}</span></div><progress value="${state.checked.size}" max="${trip.prep.length}" aria-label="예시 준비 완료율"></progress><p>여권, 예약, 이동 준비를 함께 확인해요.</p><button class="text-link ${variant==='a'?'prep-jump':''}" data-tab="prep">${variant==='a'?`준비 탭으로 이동 ${daylightArrow()}`:`준비 목록 보기 ${icon('down')}`}</button></section>`;
}
function clocks() { return `<div class="clocks"><div><span>미국 서부</span><strong>13:40</strong><small>1월 25일 월</small></div><div><span>서울</span><strong>06:40</strong><small>1월 26일 화</small></div></div>`; }
function scheduleList() {
  const day = trip.days[state.day];
  return `<div class="event-list">${day.events.map((event,i)=>`<article class="event ${state.day===4 && i===1?'featured':''}"><div class="event-time"><time>${esc(event.time)}</time><small>${esc(event.zone)}</small></div><div class="event-body"><div class="event-title"><h3>${esc(event.title)}</h3>${state.day===4 && i===1?'<span class="tag">다음 일정 · 예시</span>':''}</div><p>${esc(event.detail)}</p>${variant==='a'?daylightWarnings(event):event.warnings.length?`<details class="event-details"><summary>${icon('alert')} 확인할 사항 ${event.warnings.length}개 ${icon('down')}</summary><ul>${event.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></details>`:''}${event.map?`<a class="text-link" href="${esc(event.map.url)}" target="_blank" rel="noopener noreferrer">${icon('map')} 지도 열기</a>`:''}</div></article>`).join('')}</div>`;
}
function dayTitle() {
  return `<div class="day-title"><div><span class="small-label">DAY ${state.day+1} · ${dayLabel(trip.days[state.day])}</span><h2>${city(state.day)}</h2></div><span class="quiet">${trip.days[state.day].events.length}개 일정</span></div>`;
}
function scheduleA() {
  return `${heading(state.view==='timetable'?'여행 시간표':state.day===4?'오늘의 여행':'하루 일정', '1월 25일 여행 중 화면 · 예시', '<span class="status-dot">예시 일정</span>')}${daylightViewSwitch()}${state.view==='timetable'?daylightTimetable():`${dates()}<div class="content-grid"><section class="daily">${dayTitle()}${scheduleList()}</section><aside class="context-panel">${lodgings()}${prepMini()}<div class="zone-note">${icon('history')} 일정은 여행지 현지 시간 기준</div></aside></div>`}`;
}
function scheduleB() {
  return `<section class="postcard"><div class="postcard-copy"><h1>다음 장면은,<br>로스앤젤레스.</h1><p>Las Vegas to Los Angeles</p><div class="journey-meta"><span>2027. 01. 21 — 01. 31</span><span>둘이 함께하는 11일</span></div><button data-scroll="itinerary" class="light-button">일정 살펴보기 ${icon('down')}</button></div><figure><img src="../assets/airbnb.webp" alt="파란 하늘과 야자수가 있는 West Hollywood 숙소"><figcaption>이번 여행의 LA 베이스 · West Hollywood</figcaption></figure></section><div class="postcard-content" id="itinerary"><div class="section-heading"><h2>하루씩, 천천히.</h2><span class="quiet">현지 시간 · 예시</span></div>${dates()}<div class="content-grid"><section class="daily">${dayTitle()}${scheduleList()}</section><aside class="context-panel">${prepMini()}<section class="route-note"><h3>이번 여행의 경로</h3><ol><li>라스베이거스<span>1.21 — 1.25</span></li><li class="active">로스앤젤레스<span>1.25 — 1.29</span></li><li>인천<span>1.31 도착</span></li></ol></section></aside></div></div>`;
}
function boardColumn(index) {
  const day=trip.days[index];
  return `<section class="board-column ${index===state.day?'selected-column':''}"><header><span>${dayLabel(day)}</span><h3>${city(index)}</h3><span class="quiet">DAY ${index+1} · ${day.events.length}개 일정</span></header><div class="board-events">${day.events.map((event,i)=>`<article class="board-event ${event.title.includes('출발')?'flight':''}"><div><time>${esc(event.time)}</time><span class="quiet">${esc(event.zone)}</span></div><h4>${esc(event.title)}</h4><p>${esc(event.detail)}</p>${event.warnings.length?`<details><summary>${icon('alert')} 확인 사항</summary><p>${esc(event.warnings[0])}</p></details>`:''}${event.map?`<a class="text-link" href="${esc(event.map.url)}" target="_blank" rel="noopener noreferrer">${icon('map')} 지도</a>`:''}</article>`).join('')}</div>${day.events.length===1 && day.events[0].time==='미정'?'<div class="open-space">여유 있는 하루<br><small>자유 일정은 아직 구체화 전이에요.</small></div>':''}</section>`;
}
function scheduleC() {
  let start=Math.max(0,Math.min(state.day-1,trip.days.length-3));
  return `${heading('여행 일정', '2027. 01. 21 — 01. 31 · Las Vegas → Los Angeles', '<span class="view-chip">3일 비교</span>')}<div class="board-toolbar">${dates()}<span class="quiet">여행지 현지 시간</span></div><div class="board">${[start,start+1,start+2].map(boardColumn).join('')}</div><section class="mobile-daily">${dayTitle()}${scheduleList()}</section><div class="desk-footer"><span>${icon('alert')} 1월 25일 렌터카 픽업은 16:30 고정</span><button class="text-link" data-tab="prep">출발 전 준비 ${state.checked.size}/${trip.prep.length} ${icon('down')}</button></div>`;
}
function prep() {
  return `<div class="subpage">${heading('출발 전 준비', '체크 상태는 비교용 예시입니다. 이 화면에서만 바뀝니다.')}<div class="prep-layout"><section class="checklist"><div class="small-heading"><h2>빠짐없이, 가볍게.</h2><span id="prep-count">${state.checked.size} / ${trip.prep.length}</span></div><progress id="prep-progress" value="${state.checked.size}" max="${trip.prep.length}" aria-label="준비 완료율"></progress>${trip.prep.map((text,i)=>`<label class="check-row"><input type="checkbox" data-check="${i}" ${state.checked.has(i)?'checked':''}><span>${esc(text)}</span></label>`).join('')}</section><aside class="context-panel"><section class="note-panel"><h3>먼저 확인해요</h3><p>투어에 캐리어를 가져갈 수 있는지, 호텔에 짐을 맡길 수 있는지 확인하세요.</p><span class="small-label">그랜드캐니언 투어 · 1월 22일</span></section>${lodgings()}</aside></div></div>`;
}
const expenses=[{title:'공항에서 숙소 이동',category:'교통',amount:42,date:'1.21'},{title:'도착 첫날 저녁',category:'식비',amount:56,date:'1.21'},{title:'커피 두 잔',category:'식비',amount:12,date:'1.22'}];
function ledger() {
  const shown=expenses.filter(e=>state.expenseFilter==='all'||e.category===state.expenseFilter);
  const rows=shown.map(e=>variant==='a'?daylightExpenseRow(e):`<div class="expense-row"><span>${e.date}</span><strong>${e.title}</strong><span>${e.category}</span><strong>$${e.amount.toFixed(2)}</strong></div>`).join('');
  return `<div class="subpage">${heading('가계부', '화면 비교를 위한 가상 지출 3건 · 실제 지출이 아닙니다.')}<div class="ledger-summary"><div><span>예시 지출 합계</span><strong>$110<span>.00</span></strong><p>₩159,500 · 1 USD = 1,450 KRW</p></div><div class="ledger-note"><span>수동 환율</span><strong>1,450 KRW</strong><small>예산 미설정</small></div></div><div class="expense-heading"><h2>지출 내역</h2><label>카테고리 <select id="expense-filter"><option value="all" ${state.expenseFilter==='all'?'selected':''}>전체</option><option ${state.expenseFilter==='식비'?'selected':''}>식비</option><option ${state.expenseFilter==='교통'?'selected':''}>교통</option><option ${state.expenseFilter==='숙박'?'selected':''}>숙박</option></select></label></div><div class="expense-table"><div class="expense-row table-head"><span>날짜</span><span>항목</span><span>카테고리</span><span>금액</span></div>${shown.length?rows:'<div class="empty"><h3>숙박 지출이 없어요</h3><p>다른 카테고리의 예시 내역을 확인해 보세요.</p><button data-reset-filter class="primary-button">전체 내역 보기</button></div>'}</div><p class="footnote">실제 서비스에서는 편집자 확인 후 지출을 추가하고, 저장 시 함께 보는 가계부에 반영합니다.</p></div>`;
}
function render() {
  const content=state.tab==='prep'?prep():state.tab==='ledger'?ledger():({a:scheduleA,b:scheduleB,c:scheduleC}[variant])();
  const brand=`<a href="${variant}.html" class="brand" aria-label="WESTBOUND 처음 화면"><span class="brand-mark">w.</span><span>westbound<span class="brand-year">2027</span></span></a>`;
  const rail=variant==='a'?`<aside class="side-rail">${brand}<div class="rail-trip"><strong>미국 서부 여행</strong><span>1.21 — 1.31 · 11일</span></div>${nav()}<div class="rail-bottom">${clocks()}<span class="quiet">시각은 예시입니다</span></div></aside>`:'';
  document.getElementById('app').innerHTML=`${notice()}<div class="shell">${rail}<div class="workspace"><header class="app-header">${variant!=='a'?brand:'<span class="header-trip">미국 서부 여행 <span>/</span> '+({schedule:'일정',prep:'준비',ledger:'가계부'}[state.tab])+'</span>'}${variant!=='a'?nav():''}<div class="header-actions"><span class="members" aria-label="여행 참가자 두 명"><i>나</i><i>함께</i></span>${more()}</div></header><main id="main">${content}</main><div class="mobile-nav">${nav('mobile-nav-inner')}</div></div></div><div class="sr-only" role="status" id="feedback"></div>`;
  document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{state.tab=button.dataset.tab;render();document.querySelector('h1')?.setAttribute('tabindex','-1');document.querySelector('h1')?.focus({preventScroll:true});if(variant==='a'&&state.tab==='prep')window.scrollTo({top:0,left:0,behavior:'instant'});}));
  document.querySelectorAll('[data-day]').forEach(button=>button.addEventListener('click',()=>{state.day=Number(button.dataset.day);render();document.querySelector(`[data-day="${state.day}"]`)?.focus({preventScroll:true});}));
  document.querySelectorAll('[data-check]').forEach(input=>input.addEventListener('change',()=>{const key=Number(input.dataset.check);input.checked?state.checked.add(key):state.checked.delete(key);document.getElementById('prep-count').textContent=`${state.checked.size} / ${trip.prep.length}`;document.getElementById('prep-progress').value=state.checked.size;document.getElementById('feedback').textContent='초안에서만 변경되었습니다.';}));
  document.getElementById('expense-filter')?.addEventListener('change',event=>{state.expenseFilter=event.target.value;render();document.getElementById('expense-filter').focus();});
  document.querySelector('[data-reset-filter]')?.addEventListener('click',()=>{state.expenseFilter='all';render();document.getElementById('expense-filter').focus();});
  document.querySelector('[data-scroll]')?.addEventListener('click',()=>document.getElementById('itinerary').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  const strip=document.querySelector('.date-strip');
  const selected=strip?.querySelector('[aria-pressed="true"]');
  if(strip&&selected)strip.scrollLeft=Math.max(0,selected.offsetLeft-strip.offsetLeft-strip.clientWidth/2+selected.clientWidth/2);
  if(variant==='a') bindDaylight();
}
render();
