function createLedgerController({$,CURRENCY_CODES,DEFAULT_BUDGET_KRW,DEFAULT_CATEGORIES,DEFAULT_EXCHANGE_RATE,DELETED_CATEGORY_ID,EXPORT_BASE_NAME,ICON_CANDIDATES,LEDGER_CURRENCIES,calculateExpenseInput,clone,currencyLabel,decorateButtonIcons,documentAdapter,documentSession,emptyExpenseInput,escapeHtml,finishMutation,formatKrw,formatLedgerSum,formatUsd,isOperationBusy,parseLedgerRate,requireEditor,resetInactivityTimer,setFieldError,setStatus,showChoice,showDialog,todayLocal,uid,updateDirtyState}) {
let expenses = [];
let categories = DEFAULT_CATEGORIES.map(item => ({...item}));
let exchangeRate = DEFAULT_EXCHANGE_RATE;
let exchangeRateUpdated = '';
let budgetKrw = DEFAULT_BUDGET_KRW;
let editingCategoryId = null;
let editingExpenseId = null;
let selectedCategoryIcon = '📦';
let expenseInput=emptyExpenseInput(),expenseEditInput=emptyExpenseInput(),expenseEditSnapshot=null,expenseAddPending=false;
  function drawExpenseInput(edit=false,submit=false){
    const form=edit?expenseEditInput:expenseInput,prefix=edit?'expenseEdit':'expense',result=calculateExpenseInput(form,exchangeRate);
    for(const currency of ['krw','usd']){
      const suffix=currency==='krw'?'Krw':'Usd',input=$('#'+prefix+suffix),hint=$('#'+prefix+suffix+'Hint');if(!input)continue;
      const auto=result.money&&result.money.amountSource!=='both'&&result.money.amountSource!==currency;
      const value=form[currency]||(result.money?String(result.money['amount'+suffix]):'');
      if(!form.composing&&input.value!==value)input.value=value;
      const error=(!result.empty||submit)?result.errors[currency]:'';
      input.setAttribute('aria-invalid',error?'true':'false');hint.textContent=error||(auto?'수동 환율로 자동 계산':'');hint.classList.toggle('amount-error',Boolean(error));
    }
    if(submit&&!result.money){$('#'+prefix+(result.errors.usd?'Usd':'Krw')).focus();setStatus('금액을 확인해 주세요.');}
    return result.money;
  }
  function handleExpenseInput(event){
    const match=event.target.id?.match(/^(expense|expenseEdit)(Krw|Usd)$/);if(!match)return;
    const edit=match[1]==='expenseEdit',form=edit?expenseEditInput:expenseInput,currency=match[2].toLowerCase();
    form[currency]=event.target.value;form.touched=true;form.composing=Boolean(event.isComposing);
    drawExpenseInput(edit);
  }

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
    if(documentAdapter.migrationNotice()){let notice=$('#ledgerMigrationNotice');if(!notice){notice=document.createElement('p');notice.id='ledgerMigrationNotice';notice.className='remark';$('.expense-entry').before(notice);}notice.textContent=documentAdapter.migrationNotice();}
    drawExpenseInput();
    decorateButtonIcons($('#expenses'));decorateButtonIcons($('.expenses-head'));if(!$('#expenseDate').value)$('#expenseDate').value=todayLocal();
  }

  async function addExpense(){
    if(expenseAddPending)return;
    if(!$('#expenseName').value.trim()){$('#expenseName').focus();setStatus('항목을 입력해 주세요.');return;}
    if(!drawExpenseInput(false,true))return;
    expenseAddPending=true;
    const release=()=>{expenseAddPending=false;};
    try{await requireEditor('ledger',()=>{
      try{
        const money=drawExpenseInput(false,true),name=$('#expenseName').value.trim();if(!money||!name)return;
        expenses.push({id:uid('expense'),name,date:$('#expenseDate').value||todayLocal(),categoryId:$('#expenseCategory').value||'misc',...money});
        $('#expenseName').value='';expenseInput=emptyExpenseInput();renderLedger();finishMutation();
      }finally{release();}
    },release);}catch(error){release();throw error;}
  }
  async function requestExpenseEdit(id){if(!expenses.some(item=>item.id===id))return;await requireEditor('ledger',()=>openExpenseDialog(id));}
  function openExpenseDialog(id){
    const item=expenses.find(entry=>entry.id===id);if(!item)return;editingExpenseId=id;expenseEditSnapshot=JSON.stringify(item);
    expenseEditInput={krw:item.amountSource==='usd'?'':String(item.amountKrw),usd:item.amountSource==='krw'?'':String(item.amountUsd),original:clone(item),touched:false,composing:false};
    $('#expenseEditDate').value=item.date||todayLocal();setExpenseCategoryOptions($('#expenseEditCategory'),item.categoryId,item.categoryId===DELETED_CATEGORY_ID);$('#expenseEditName').value=item.name;setFieldError('expenseEditName');drawExpenseInput(true);showDialog($('#expenseDialog'));$('#expenseEditName').focus();
  }
  async function saveExpenseChanges(){
    if(!$('#expenseEditName').value.trim()){setFieldError('expenseEditName','항목을 입력해 주세요.');$('#expenseEditName').focus();return;}
    if(!drawExpenseInput(true,true))return;
    const id=editingExpenseId,snapshot=expenseEditSnapshot;
    await requireEditor('ledger',()=>{
      const target=expenses.find(entry=>entry.id===id),remote=documentSession.snapshot().pendingRemoteState?.state?.expenses.find(entry=>entry.id===id);
      if(!target||JSON.stringify(target)!==snapshot||(documentSession.snapshot().pendingRemoteState&&JSON.stringify(remote)!==snapshot)){setStatus('내역이 변경되었습니다. 취소 후 최신 내역을 다시 확인해 주세요.');return;}
      const money=drawExpenseInput(true,true);if(!money)return;
      Object.assign(target,{name:$('#expenseEditName').value.trim(),date:$('#expenseEditDate').value||todayLocal(),categoryId:$('#expenseEditCategory').value||'misc',...money});
      $('#expenseDialog').hidden=true;editingExpenseId=null;expenseEditInput=emptyExpenseInput();renderLedger();finishMutation();
    });
  }
  async function moveExpense(id,direction){await requireEditor('ledger',()=>{const index=expenses.findIndex(item=>item.id===id),next=index+direction;if(index<0||next<0||next>=expenses.length)return;const [item]=expenses.splice(index,1);expenses.splice(next,0,item);renderLedger();finishMutation();});}
  async function deleteExpense(id){const item=expenses.find(x=>x.id===id);if(!item)return;const choice=await showChoice({title:'가계부 항목을 삭제할까요?',message:item.name+' 항목을 삭제합니다.',choices:[{label:'취소',value:'cancel'},{label:'삭제',value:'delete',className:'action-danger'}]});if(choice!=='delete')return;await requireEditor('ledger',async()=>{expenses=expenses.filter(x=>x.id!==id);renderLedger();finishMutation();});}
  function renderIconPicker(){const picker=$('#categoryIconPicker');picker.innerHTML=ICON_CANDIDATES.map(icon=>'<button class="'+(icon===selectedCategoryIcon?'active':'')+'" data-category-icon="'+icon+'" type="button">'+icon+'</button>').join('');}
  function openLedgerSettings(){renderLedger();$('#settingsExchangeRate').value=String(exchangeRate);showDialog($('#ledgerSettingsDialog'));setStatus(documentSession.snapshot().pendingDraft?'가계부 설정 중 · 저장되지 않음':'가계부 설정');}
  function openCategoryDialog(id=null){editingCategoryId=id;const cat=id?getCategory(id):null;selectedCategoryIcon=cat?.icon||'📦';$('#categoryTitle').textContent=id?'카테고리 수정':'카테고리 추가';$('#categoryName').value=cat?.name||'';setFieldError('categoryName');renderIconPicker();showDialog($('#categoryDialog'));$('#categoryName').focus();}
  function saveCategory(){const name=$('#categoryName').value.trim();if(!name){setFieldError('categoryName','카테고리 이름을 입력해 주세요.');$('#categoryName').focus();return;}if(editingCategoryId){const cat=getCategory(editingCategoryId);if(cat.system)return;cat.name=name;cat.icon=selectedCategoryIcon;}else{const deletedIndex=categories.findIndex(item=>item.id===DELETED_CATEGORY_ID);categories.splice(deletedIndex<0?categories.length:deletedIndex,0,{id:uid('category'),name,icon:selectedCategoryIcon,system:false});}$('#categoryDialog').hidden=true;renderLedger();finishMutation();}
  async function deleteCategory(id){const cat=getCategory(id);if(!cat||cat.system)return;const count=expenses.filter(x=>x.categoryId===id).length;const choice=await showChoice({title:'카테고리를 삭제할까요?',message:count?count+'개 내역은 “삭제된 카테고리”로 이동합니다.':'이 카테고리를 삭제합니다.',choices:[{label:'취소',value:'cancel'},{label:'삭제',value:'delete',className:'action-danger'}]});if(choice!=='delete')return;expenses.forEach(x=>{if(x.categoryId===id)x.categoryId=DELETED_CATEGORY_ID;});categories=categories.filter(x=>x.id!==id);renderLedger();finishMutation();}
  function updateExchangeRate(input=$('#settingsExchangeRate')){let value;try{value=parseLedgerRate(input?.value||'');}catch(_){value=NaN;}if(!Number.isFinite(value)||value<=0){if(input)input.value=String(exchangeRate);setStatus('올바른 환율을 입력해 주세요.');return;}exchangeRate=value;exchangeRateUpdated=new Date().toISOString();renderLedger();finishMutation();setStatus('환율 변경됨 · 저장되지 않음');}
  function csvCell(value){let text=String(value??'');if(/^[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
  function exportExpensesCsv(){const rows=expenses,header=['날짜','내용','카테고리',currencyLabel('krw')+' 금액',currencyLabel('usd')+' 금액','자동 계산 통화','적용 환율'],lines=[header,...rows.map(item=>[item.date,item.name,getCategory(item.categoryId).name,item.amountKrw,item.amountUsd,item.amountSource==='both'?'':item.amountSource==='krw'?CURRENCY_CODES.quote:CURRENCY_CODES.base,item.appliedExchangeRate??''])].map(row=>row.map(csvCell).join(',')),blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),anchor=document.createElement('a');anchor.href=URL.createObjectURL(blob);anchor.download=EXPORT_BASE_NAME+'_EXPENSES_'+todayLocal()+'.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(anchor.href),2000);setStatus('가계부 '+rows.length+'개 항목을 CSV로 내보냈습니다.');}

function readLedgerState(){return clone({expenses,categories,exchangeRate,exchangeRateUpdated,budgetKrw});}
function restoreLedgerState(state){expenses=clone(state.expenses);categories=clone(state.categories);exchangeRate=state.exchangeRate;exchangeRateUpdated=state.exchangeRateUpdated;budgetKrw=state.budgetKrw;}
function captureExpenseBuffer(){return clone(expenseInput);}
function restoreExpenseBuffer(value){expenseInput=clone(value);}
function expenseEntryPending(){return expenseAddPending;}
function resetLedgerSelection(){editingCategoryId=null;editingExpenseId=null;}

function bindLedgerControls(){
$('#categoryCancel').onclick=()=>$('#categoryDialog').hidden=true;
$('#categorySave').onclick=saveCategory;
['categoryName','expenseEditName'].forEach(id=>$('#'+id).addEventListener('input',()=>setFieldError(id)));
$('#ledgerSettingsClose').onclick=()=>{const rateInput=$('#settingsExchangeRate');let rate;try{rate=parseLedgerRate(rateInput.value);}catch(_){rate=NaN;}if(!Number.isFinite(rate)||rate<=0){rateInput.value=String(exchangeRate);setStatus('올바른 환율을 입력해 주세요.');return;}const changed=rate!==exchangeRate;if(changed){exchangeRate=rate;exchangeRateUpdated=new Date().toISOString();}$('#ledgerSettingsDialog').hidden=true;if(changed){renderLedger();finishMutation();setStatus('가계부 설정 변경됨 · 저장되지 않음');}else updateDirtyState();resetInactivityTimer();};
$('#expenseEditCancel').onclick=()=>{$('#expenseDialog').hidden=true;editingExpenseId=null;expenseEditInput=emptyExpenseInput();};
$('#expenseEditSave').onclick=saveExpenseChanges;
document.addEventListener('click',event=>{if(isOperationBusy())return;
if(event.target.closest('#addExpense')){addExpense();return;}
if(event.target.closest('#expenseCsvExport')){exportExpensesCsv();return;}
if(event.target.closest('#addCategoryBtn,#settingsAddCategory')){requireEditor('ledger',()=>openCategoryDialog());return;}
const expenseId=event.target.dataset.removeExpense;if(expenseId){deleteExpense(expenseId);return;}
const editExpenseId=event.target.closest('[data-edit-expense]')?.dataset.editExpense;if(editExpenseId){requestExpenseEdit(editExpenseId);return;}
const moveButton=event.target.closest('[data-move-expense]');if(moveButton&&!moveButton.disabled){moveExpense(moveButton.dataset.moveExpense,Number(moveButton.dataset.moveDirection));return;}
const editId=event.target.dataset.categoryEdit;if(editId){requireEditor('ledger',()=>openCategoryDialog(editId));return;}
const deleteId=event.target.dataset.categoryDelete;if(deleteId){requireEditor('ledger',()=>deleteCategory(deleteId));return;}
const icon=event.target.dataset.categoryIcon;if(icon){selectedCategoryIcon=icon;renderIconPicker();}
});
document.addEventListener('input',handleExpenseInput);
document.addEventListener('compositionend',handleExpenseInput);
document.addEventListener('change',async event=>{if(event.target.id==='settingsExchangeRate'||event.target.id==='exchangeRate'){const input=event.target,before=String(exchangeRate);await requireEditor('ledger',()=>updateExchangeRate(input),()=>{input.value=before;});return;}});
}

return Object.freeze({drawExpenseInput,handleExpenseInput,configureCurrencyLabels,getCategory,setExpenseCategoryOptions,formatExpenseDate,renderLedgerAmounts,renderLedger,addExpense,requestExpenseEdit,openExpenseDialog,saveExpenseChanges,moveExpense,deleteExpense,renderIconPicker,openLedgerSettings,openCategoryDialog,saveCategory,deleteCategory,updateExchangeRate,csvCell,exportExpensesCsv,readLedgerState,restoreLedgerState,captureExpenseBuffer,restoreExpenseBuffer,expenseEntryPending,resetLedgerSelection,bindLedgerControls});
}
