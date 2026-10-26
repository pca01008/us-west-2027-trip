function configureCurrencyLabels(){
    // Keep the deployed legacy DOM and wording byte-for-byte equivalent.
    if(CURRENCY_CODES.base==='KRW'&&CURRENCY_CODES.quote==='USD')return;
    for(const [slot,suffix] of [['krw','Krw'],['usd','Usd']]){
      const currency=LEDGER_CURRENCIES[slot];
      for(const prefix of ['expense','expenseEdit']){
        const label=document.querySelector('label[for="'+prefix+suffix+'"]>span');
        if(label)label.textContent=currency.label+' ('+currency.code+')';
      }
      const total=document.getElementById('total'+suffix);
      if(total)total.previousElementSibling.textContent=currency.label+' 합계';
    }
    const rate=document.querySelector('.exchange-rate-control');
    if(rate){rate.firstElementChild.textContent='1 '+CURRENCY_CODES.quote;rate.lastElementChild.textContent=CURRENCY_CODES.base;
      rate.querySelector('input').setAttribute('aria-label','1 '+CURRENCY_CODES.quote+' 기준 '+currencyLabel('krw')+' 환율');}
    const settings=document.querySelector('.ledger-settings-rate-control');
    if(settings){settings.firstChild.textContent='1 '+CURRENCY_CODES.quote+' = ';settings.lastChild.textContent=' '+CURRENCY_CODES.base;}
  }
  function getCategory(id) { return categories.find(item=>item.id===id) || categories.find(item=>item.id==='misc') || categories[0]; }
  function setExpenseCategoryOptions(select,selected='',includeDeleted=false){if(!select)return;const items=categories.filter(item=>item.id!==DELETED_CATEGORY_ID||includeDeleted||item.id===selected);select.innerHTML=items.map(item=>'<option value="'+escapeHtml(item.id)+'"'+(item.id===DELETED_CATEGORY_ID?' disabled':'')+'>'+escapeHtml(item.icon+' '+item.name)+'</option>').join('');if(items.some(item=>item.id===selected))select.value=selected;}
  function formatExpenseDate(date){return date?date.replace(/-/g,'.'):'날짜 미지정';}
  function renderLedgerAmounts(base,quote,source=''){
    const automatic=' <small>자동 계산</small>';
    return '<span class="ledger-amount-base">'+escapeHtml(base)+(source==='usd'?automatic:'')+'</span> <span class="ledger-amount-quote">('+escapeHtml(quote)+(source==='krw'?automatic:'')+')</span>';
  }
  function renderLedger() {
    configureCurrencyLabels();
    $('#totalKrw').textContent=formatLedgerSum(expenses,'krw');$('#totalUsd').textContent=formatLedgerSum(expenses,'usd');
    $('#exchangeRate').value=String(exchangeRate);$('#exchangeRateUpdated').textContent=exchangeRateUpdated?'수정 '+new Date(exchangeRateUpdated).toLocaleDateString('ko-KR'):'수동 환율';
    const select=$('#expenseCategory'),previous=select.value;setExpenseCategoryOptions(select,previous);
    $('#categorySummary').innerHTML=categories.map(category=>{const items=expenses.filter(item=>item.categoryId===category.id);if(!items.length)return '';return '<div class="category-total"><span>'+escapeHtml(category.icon+' '+category.name)+'</span><b class="ledger-amount">'+renderLedgerAmounts(formatLedgerSum(items,'krw'),formatLedgerSum(items,'usd'))+'</b></div>';}).join('')||'<div class="diff-empty">아직 카테고리별 내역이 없습니다.</div>';
    const categoryChips=categories.map(category=>'<span class="category-chip'+(category.system?' system':'')+'"><b>'+escapeHtml(category.icon)+'</b>'+escapeHtml(category.name)+(category.system?'':'<button data-category-edit="'+escapeHtml(category.id)+'" type="button">수정</button><button data-category-delete="'+escapeHtml(category.id)+'" type="button">삭제</button>')+'</span>').join('');$('#categoryManagerList').innerHTML=categoryChips;if($('#settingsCategoryList'))$('#settingsCategoryList').innerHTML=categoryChips;
    if($('#ledgerSettingsDialog')&&!$('#ledgerSettingsDialog').hidden){$('#settingsExchangeRate').value=String(exchangeRate);}
    $('#expenses').innerHTML=expenses.length?expenses.map(item=>{const category=getCategory(item.categoryId),id=escapeHtml(item.id),name=escapeHtml(item.name),index=expenses.findIndex(entry=>entry.id===item.id);return '<div class="expense" data-expense-id="'+id+'"><div class="expense-copy"><div class="expense-primary"><time class="expense-date" datetime="'+escapeHtml(item.date||'')+'">'+escapeHtml(formatExpenseDate(item.date))+'</time><b>'+name+'</b></div><span class="expense-category-badge">'+escapeHtml(category.icon+' '+category.name)+'</span></div><div class="expense-side"><strong class="expense-amount ledger-amount">'+renderLedgerAmounts(formatKrw(item.amountKrw),formatUsd(item.amountUsd),item.amountSource)+'</strong><div class="expense-actions"><button class="expense-action" data-icon="up" data-move-expense="'+id+'" data-move-direction="-1" type="button" aria-label="'+name+' 위로 이동" title="위로 이동"'+(index===0?' disabled':'')+'></button><button class="expense-action" data-icon="down" data-move-expense="'+id+'" data-move-direction="1" type="button" aria-label="'+name+' 아래로 이동" title="아래로 이동"'+(index===expenses.length-1?' disabled':'')+'></button><button class="expense-action" data-edit-expense="'+id+'" data-icon="edit" type="button">수정</button><button class="expense-action delete" data-remove-expense="'+id+'" type="button">삭제</button></div></div></div>';}).join(''):'<div class="remark">'+'아직 기록된 경비가 없습니다.'+'</div>';
    if(ledgerMigrationNotice){let notice=$('#ledgerMigrationNotice');if(!notice){notice=document.createElement('p');notice.id='ledgerMigrationNotice';notice.className='remark';$('.expense-entry').before(notice);}notice.textContent=ledgerMigrationNotice;}
    drawExpenseInput();
    decorateButtonIcons($('#expenses'));decorateButtonIcons($('.expenses-head'));if(!$('#expenseDate').value)$('#expenseDate').value=todayLocal();
  }
