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
