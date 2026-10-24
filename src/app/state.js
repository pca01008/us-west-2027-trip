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
      Array.from(template.content.querySelectorAll('.moneyday')).slice(1).forEach(panel=>panel.remove());
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
  function normalizeState(raw, imported=false) {
    assertSupportedSchema(raw);
    assertCurrencyPair(raw);
    const cats=normalizeCategories(raw?.categories);
    const rate=Number(raw?.exchangeRate);
    return {
      schemaVersion:SCHEMA_VERSION,
      ...currencyMetadata(),
      html:sanitizeMarkup(raw?.html || $('main').innerHTML, imported),
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
