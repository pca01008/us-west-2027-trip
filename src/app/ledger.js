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
