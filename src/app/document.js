/** DOM serialization/repair boundary. Normalization needs an explicit fallback. */
function createDocumentAdapter({$,$$,DEFAULT_BUDGET_KRW,DEFAULT_EXCHANGE_RATE,IMPORT_ALLOWED_MONEY_IDS,MEDIA_PATH_PATTERN,SCHEMA_VERSION,TIMETABLE_KINDS,SUPABASE_URL,TRIP_ID,TRIP_DAYS,afterApply,assertCurrencyPair,assertSupportedSchema,beforeApply,clone,currencyMetadata,drawExpenseInput,entryPending,hashText,normalizeCategories,normalizeExpenses,pendingCheckBefore,photoResources,readEntryBuffer,readLedger,renderCheckFeedback,renderDocument,replaceLedger,restoreEntryBuffer,scheduleKindMode,sumLedgerAmounts}) {
let applyingHistory=false,moneyTemplateHtml="";
  function validateDocumentMarkup(markup,{legacy=false,ledger=false}={}) {
    const template=document.createElement('template');template.innerHTML=markup;
    const root=template.content,expected=['prepday','moneyday',...TRIP_DAYS.map((_,index)=>'day'+(index+1))];
    const invalid=()=>{throw new Error('작업본의 필수 화면 구조가 없거나 손상되었습니다. 원본 페이지에서 작업본을 다시 내려받아 주세요.');};
    const panels=Array.from(root.querySelectorAll('[class]')).filter(el=>el.matches('.panel,.day,.prepday,.moneyday')||Array.from(el.classList).some(name=>/^day\d+$/.test(name)));
    const seen=new Set();
    for(const panel of panels){
      const names=Array.from(panel.classList).filter(name=>expected.includes(name)||/^day\d+$/.test(name));
      if(panel.parentNode!==root||!panel.matches('section.panel.day')||names.length!==1||!expected.includes(names[0])||seen.has(names[0]))invalid();
      seen.add(names[0]);
    }
    if(!seen.has('prepday')||!seen.has('moneyday')||!Array.from(seen).some(name=>/^day\d+$/.test(name)))invalid();
    for(const name of expected){
      if(seen.has(name))continue;
      // v4 exports could omit unused days. Restore empty shells, never default events.
      if(!legacy)invalid();
      const panel=document.createElement('section');panel.className='panel day '+name;
      panel.innerHTML='<div class="day-head"><h2></h2><p></p></div>';root.appendChild(panel);
    }
    const prep=root.querySelector('.prepday');
    if(prep.querySelectorAll(':scope > .checklist').length!==1)invalid();
    for(const label of prep.querySelectorAll('.checklist label')){
      if(label.querySelectorAll('input').length!==1||!label.querySelector('input[type="checkbox"]')||!label.querySelector('span'))invalid();
    }
    for(const day of root.querySelectorAll('.day:not(.prepday):not(.moneyday)')){
      if(day.querySelectorAll(':scope > .day-head').length!==1||!day.querySelector(':scope > .day-head > h2')||!day.querySelector(':scope > .day-head > p'))invalid();
    }
    for(const row of root.querySelectorAll('.timeline-row')){
      if(!row.parentElement?.matches('.day:not(.prepday):not(.moneyday)')||!row.querySelector(':scope > .time')||!row.querySelector(':scope > .card > h3')||!row.querySelector(':scope > .card > .remark'))invalid();
    }
    for(const photo of root.querySelectorAll('.schedule-photo'))if(!photo.querySelector('img'))invalid();
    if(ledger)for(const id of IMPORT_ALLOWED_MONEY_IDS)if(root.querySelectorAll('.moneyday #'+id).length!==1)invalid();
    return template.innerHTML;
  }
  function sanitizeMarkup(markup, imported=false) {
    const template=document.createElement('template'); template.innerHTML=markup||'';
    template.content.querySelectorAll('script,style,iframe,object,embed,link,meta,form,.memo,.map,.schedule-media-tools,.photo-actions,.row-actions,.photo-delete,.row-delete,.check-delete,.check-actions,.check-feedback,.warning-delete').forEach(el=>el.remove());
    template.content.querySelectorAll('.is-active').forEach(el=>el.classList.remove('is-active'));
    template.content.querySelectorAll('.panel.day').forEach(el=>el.removeAttribute('aria-hidden'));
    template.content.querySelectorAll('[data-schedule-kind]').forEach(el=>{if(!el.classList.contains('timeline-row')||scheduleKindMode(el.dataset.scheduleKind)==='auto')el.removeAttribute('data-schedule-kind');});
    if(imported){
      const allowed=new Set(['SECTION','DIV','H2','H3','P','ARTICLE','SPAN','SMALL','STRONG','B','I','LABEL','INPUT','BR','FIGURE','FIGCAPTION','IMG','A','UL','LI']);
      template.content.querySelectorAll('*').forEach(el=>{if(!allowed.has(el.tagName))el.remove();});
    }
    template.content.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name=attr.name.toLowerCase();
        if (name.startsWith('on') || (imported && name==='style')) el.removeAttribute(attr.name);
      });
      if (el.hasAttribute('contenteditable')) el.setAttribute('contenteditable','false');
      if(el.hasAttribute('style')&&!el.getAttribute('style').trim())el.removeAttribute('style');
    });
    template.content.querySelectorAll('a[href]').forEach(a => { if (!/^https:\/\//i.test(a.getAttribute('href')||'')) a.removeAttribute('href'); });
    template.content.querySelectorAll('a[href]').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer';});
    template.content.querySelectorAll('img').forEach(img => {
      // Only the validated src may choose an image resource.
      img.removeAttribute('srcset');
      const src=img.getAttribute('src')||'';
      if (!/^data:image\/(webp|jpeg|png);base64,/i.test(src) && !src.startsWith(SUPABASE_URL+'/storage/') && !/^assets\/[a-zA-Z0-9._/-]+$/.test(src)) img.removeAttribute('src');
      const full=img.getAttribute('data-full-url')||'';
      if (full && !/^data:image\/(webp|jpeg|png);base64,/i.test(full) && !full.startsWith(SUPABASE_URL+'/storage/') && !/^assets\/[a-zA-Z0-9._/-]+$/.test(full)) img.removeAttribute('data-full-url');
      if(!img.hasAttribute('alt'))img.alt='일정 사진';
      img.loading='lazy'; img.decoding='async';
    });
    template.content.querySelectorAll('.schedule-photo').forEach(figure=>{
      ['data-full-path','data-thumb-path'].forEach(name=>{const value=figure.getAttribute(name)||'';if(value&&!MEDIA_PATH_PATTERN.test(value))figure.removeAttribute(name);});
    });
    const savedMoney=template.content.querySelector('.moneyday');
    if (savedMoney && moneyTemplateHtml) { const replacement=document.createElement('template'); replacement.innerHTML=moneyTemplateHtml; savedMoney.replaceWith(replacement.content.firstElementChild); }
    if(imported){
      // Repair IDs before comparison, so duplicate entries cannot hide changes.
      for(const [selector,attribute,prefix] of [['.timeline-row','data-row-id','row'],['.checklist label','data-check-id','check'],['.schedule-photo','data-photo-id','photo']]){
        const elements=Array.from(template.content.querySelectorAll(selector)),reserved=new Set(elements.map(el=>el.getAttribute(attribute)).filter(Boolean)),seen=new Set();
        elements.forEach((el,index)=>{
          let id=el.getAttribute(attribute);
          if(!id||seen.has(id)){
            const base='import-'+prefix+'-'+index+'-'+hashText(el.textContent||'');let suffix=0;id=base;
            while(reserved.has(id)||seen.has(id))id=base+'-'+(++suffix);
            el.setAttribute(attribute,id);
          }
          seen.add(id);
        });
      }
      const seenIds=new Set();
      template.content.querySelectorAll('[id]').forEach(element=>{
        const id=element.id;
        if(!element.closest('.moneyday')||!IMPORT_ALLOWED_MONEY_IDS.has(id)||seenIds.has(id))element.removeAttribute('id');
        else seenIds.add(id);
      });
    }
    const rendered=template.content.querySelector('#expenses'); if(rendered) rendered.innerHTML='';
    const manager=template.content.querySelector('#categoryManagerList'); if(manager) manager.innerHTML='';
    const summary=template.content.querySelector('#categorySummary'); if(summary) summary.innerHTML='';
    template.content.querySelectorAll('input[type="checkbox"]').forEach(input=>{input.removeAttribute('checked');input.removeAttribute('disabled');});
    return template.innerHTML;
  }
  function normalizeState(raw, {imported=false,fallback=null}={}) {
    if(!raw?.html&&!fallback?.html)throw new TypeError('A document snapshot or explicit fallback is required.');
    assertSupportedSchema(raw);
    assertCurrencyPair(raw);
    const cats=normalizeCategories(raw?.categories);
    const rate=Number(raw?.exchangeRate);
    return {
      schemaVersion:SCHEMA_VERSION,
      ...currencyMetadata(),
      html:(()=>{
        const markup=raw?.html || fallback?.html || '';
        const prepared=imported?validateDocumentMarkup(markup,{legacy:Number(raw?.schemaVersion||0)<5}):markup;
        const html=sanitizeMarkup(prepared,imported);
        return imported?validateDocumentMarkup(html,{ledger:true}):html;
      })(),
      expenses:(()=>{try{return normalizeExpenses(raw?.expenses,cats,Number.isFinite(rate)&&rate>0?rate:DEFAULT_EXCHANGE_RATE,Number(raw?.schemaVersion)||0);}catch(error){error.code='DOCUMENT_LEDGER';throw error;}})(),
      categories:cats,
      exchangeRate:Number.isFinite(rate)&&rate>0 ? rate : DEFAULT_EXCHANGE_RATE,
      exchangeRateUpdated:String(raw?.exchangeRateUpdated||''),
      budgetKrw:Number.isFinite(Number(raw?.budgetKrw))&&Number(raw.budgetKrw)>=0?Number(raw.budgetKrw):DEFAULT_BUDGET_KRW,
      checks:Array.isArray(raw?.checks)?raw.checks.map(Boolean):null
    };
  }
  function checkLabelText(label) {
    return (label.querySelector('span')?.textContent || Array.from(label.childNodes).filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('')).trim();
  }
  let ledgerMigrationNotice='';
  function preserveLegacyLedger(raw){
    if(Number(raw?.schemaVersion||0)>=6||!raw?.expenses?.length)return;
    const normalized=normalizeState(raw),rate=normalized.exchangeRate;
    const oldTotal=raw.expenses.reduce((sum,item)=>sum+(item.currency==='KRW'?Number(item.amount):Number(item.amount)*rate),0);
    const delta=Math.round(sumLedgerAmounts(normalized.expenses,'amountKrw'))-Math.round(oldTotal);
    const key=TRIP_ID+'_ledger_v5_backup';
    try{
      if(localStorage.getItem(key))return;
      localStorage.setItem(key,JSON.stringify(raw));
      ledgerMigrationNotice='기존 내역은 저장된 환율로 계산해 유지합니다. 전환 기준 1 USD = '+rate.toLocaleString('ko-KR')+' KRW · 이전 원화 환산 합계와 차이 '+(delta>0?'+':'')+delta+'원.'+(!Number.isFinite(Number(raw.exchangeRate))||Number(raw.exchangeRate)<=0?' 저장된 환율이 없어 기본 환율을 사용했습니다.':'');
    }catch(_){ledgerMigrationNotice='기존 내역은 저장된 환율로 계산해 유지합니다. 전환 전 작업본 보관에 실패했습니다. 저장 전 작업본을 별도로 보관해 주세요.';}
  }
  function migratePublishedState(raw) {
    assertSupportedSchema(raw);
    assertCurrencyPair(raw);
    if (!raw?.html || Number(raw.schemaVersion||0) >= SCHEMA_VERSION) return raw;
    preserveLegacyLedger(raw);
    const previous=document.createElement('template');previous.innerHTML=raw.html;
    previous.content.querySelectorAll('.timeline-row').forEach((row,index)=>{
      if(!row.dataset.rowId)row.dataset.rowId='legacy-row-'+index+'-'+hashText(row.textContent||'');
    });
    previous.content.querySelectorAll('.prepday .checklist label').forEach((label,index)=>{
      if(!label.dataset.checkId)label.dataset.checkId='legacy-check-'+index+'-'+hashText(checkLabelText(label));
    });
    return {...raw,html:previous.innerHTML,checks:Array.isArray(raw.checks)?raw.checks.map(Boolean):null};
  }

function captureState() {
    const {expenses,categories,exchangeRate,exchangeRateUpdated,budgetKrw}=readLedger();
    const main=$('main').cloneNode(true);
    main.querySelectorAll('[contenteditable]').forEach(el=>el.setAttribute('contenteditable','false'));
    main.querySelectorAll('.schedule-media-tools,.photo-actions,.row-actions,.photo-delete,.schedule-map-delete,.row-delete,.check-delete,.check-actions,.check-feedback,.warning-delete').forEach(el=>el.remove());
    main.querySelector('#ledgerMigrationNotice')?.remove();
    main.querySelectorAll('.add-expense .amount-hint').forEach(el=>{el.textContent='';el.classList.remove('amount-error');});
    main.querySelectorAll('.add-expense input').forEach(el=>{el.removeAttribute('value');el.removeAttribute('aria-invalid');});
    const rendered=main.querySelector('#expenses');if(rendered)rendered.innerHTML='';
    const manager=main.querySelector('#categoryManagerList');if(manager)manager.innerHTML='';
    const summary=main.querySelector('#categorySummary');if(summary)summary.innerHTML='';
    main.querySelectorAll('input[type="checkbox"]').forEach(input=>{input.removeAttribute('checked');input.removeAttribute('disabled');});
    return {schemaVersion:SCHEMA_VERSION,...currencyMetadata(),html:main.innerHTML,expenses:clone(expenses),categories:clone(categories),exchangeRate,exchangeRateUpdated,budgetKrw,checks:$$('main input[type="checkbox"]').map(input=>pendingCheckBefore(input.closest('[data-check-id]')?.dataset.checkId)??input.checked)};
  }

function applyState(raw) {
    if(!raw?.html)return; const state=normalizeState(raw);state.html=validateDocumentMarkup(state.html,{ledger:true});
    const main=$('main'),previousNodes=Array.from(main.childNodes),previousLedger=clone(readLedger()),previousBuffer=readEntryBuffer();
    const active=document.activeElement,selection=active instanceof HTMLInputElement?[active.selectionStart,active.selectionEnd]:null;
    const pendingEntry=entryPending()?$$('.add-expense input,.add-expense select').map(input=>({id:input.id,value:input.value})):[];
    applyingHistory=true;
    try{
      beforeApply();
      main.innerHTML=state.html;replaceLedger(state);
      renderDocument();
      pendingEntry.forEach(({id,value})=>{const input=$('#'+id);if(input&&(input.tagName!=='SELECT'||Array.from(input.options).some(option=>option.value===value)))input.value=value;});drawExpenseInput();
      if(Array.isArray(state.checks))$$('main input[type="checkbox"]').forEach((input,index)=>input.checked=Boolean(state.checks[index]));
      afterApply();renderCheckFeedback();
    }catch(error){
      // Keep the original nodes and their input values/listeners; recovery must not render again.
      main.replaceChildren(...previousNodes);replaceLedger(previousLedger);restoreEntryBuffer(previousBuffer);
      if(active?.isConnected){active.focus({preventScroll:true});if(selection&&selection[0]!==null)active.setSelectionRange(...selection);}
      throw error;
    }finally{applyingHistory=false;}
  }
function applyStatePreservingInputs(state) {
    // Preserve unsubmitted expense entry and keyboard focus across rendering.
    const preservedExpenseInput=readEntryBuffer();
    const fields=$$('.add-expense input,.add-expense select').map(input=>({id:input.id,value:input.value}));
    const active=document.activeElement,wasInMain=Boolean(active?.closest('main')),focusId=active?.id,checkId=active?.closest('.prepday [data-check-id]')?.dataset.checkId;
    const selection=active instanceof HTMLInputElement?[active.selectionStart,active.selectionEnd]:null;
    applyState(state);
    fields.forEach(({id,value})=>{const input=document.getElementById(id);if(input&&(input.tagName!=='SELECT'||Array.from(input.options).some(option=>option.value===value)))input.value=value;});
    restoreEntryBuffer(preservedExpenseInput);drawExpenseInput();
    const focus=checkId?$$('.prepday [data-check-id]').find(label=>label.dataset.checkId===checkId)?.querySelector('input'):focusId?document.getElementById(focusId):null;
    if(focus&&wasInMain&&!focus.disabled){focus.focus({preventScroll:true});if(selection&&selection[0]!==null)focus.setSelectionRange(...selection);}
  }
function setMoneyTemplate(html){moneyTemplateHtml=html;}
function isApplying(){return applyingHistory;}
function migrationNotice(){return ledgerMigrationNotice;}

function stateSummary(state){const template=document.createElement('template');template.innerHTML=state.html;const schedules=[];template.content.querySelectorAll('.day:not(.prepday):not(.moneyday)').forEach((day,dayIndex)=>day.querySelectorAll('.timeline-row').forEach((row,index)=>{const mapLink=row.querySelector('.schedule-map a');schedules.push({id:row.dataset.rowId||'position-'+dayIndex+'-'+index,key:'DAY '+(dayIndex+1)+' 일정 '+(index+1),dayIndex,index,stay:row.dataset.stayCheckout||'',kind:TIMETABLE_KINDS[scheduleKindMode(row.dataset.scheduleKind)]||'자동',time:row.querySelector('.time')?.textContent.trim()||'',title:row.querySelector('h3')?.textContent.trim()||'',detail:row.querySelector('.remark')?.textContent.trim()||'',warning:Array.from(row.querySelectorAll('.schedule-warning')).map(item=>(item.querySelector('.schedule-warning-text')||item).textContent.trim()).filter(Boolean).join(' | '),mapName:mapPlaceName(mapLink),map:mapLink?.href||'',photos:Array.from(row.querySelectorAll('.schedule-photo')).map(photo=>{const img=photo.querySelector('img');return {id:photo.dataset.photoId||photo.dataset.fullPath||'photo',caption:photo.querySelector('figcaption')?.textContent.trim()||'',alt:img?.alt||'',full:photoResources.imageResource(img,'full',photo.dataset.fullPath),thumb:photoResources.imageResource(img,'thumb',photo.dataset.thumbPath)};})});}));const checks=Array.from(template.content.querySelectorAll('.checklist label span')).map((span,index)=>({id:span.closest('label')?.dataset.checkId||'position-'+index,text:span.textContent.trim(),important:span.closest('label')?.dataset.checkImportant==='true',checked:Boolean(state.checks?.[index])}));const days=Array.from(template.content.querySelectorAll('.day:not(.prepday):not(.moneyday)')).map(day=>day.querySelector('.day-head p')?.textContent.trim()||'');return {days,schedules,checks,expenses:state.expenses,categories:state.categories,exchangeRate:state.exchangeRate};}
function mapPlaceName(anchor) {
    if(!anchor)return '';
    const stored=anchor?.dataset.placeName?.trim();
    if(stored)return stored;
    const raw=(anchor?.querySelector('.map-link-label')?.textContent||anchor?.textContent||'').replace(/↗/g,'').trim();
    return raw.replace(/^Google Maps\s*[·-]\s*/i,'').replace(/\s*[·-]\s*Google Maps$/i,'').trim()||'위치';
  }
return Object.freeze({stateSummary,mapPlaceName,sanitizeMarkup,normalizeState,checkLabelText,preserveLegacyLedger,migratePublishedState,captureState,applyState,applyStatePreservingInputs,setMoneyTemplate,isApplying,migrationNotice});
}
