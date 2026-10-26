/** Plain-summary comparison. DOM projection belongs to the document adapter. */
function createComparison({TRIP_DAYS,CURRENCY_CODES,currencyLabel}){
function compareSummaries(before,after){
    const groups=[];
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
      if(old.dayIndex!==item.dayIndex){const date=event=>TRIP_DAYS[event.dayIndex]?.date||'DAY '+(event.dayIndex+1);scheduleChanges.push(item.key+' 날짜: '+date(old)+' → '+date(item));}
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
return Object.freeze({compareSummaries});
}
