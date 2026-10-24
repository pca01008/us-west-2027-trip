  function decimalParts(value) {
    const text=String(value),match=text.match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
    if(!match||text.length>400)throw new Error('올바른 금액을 입력해 주세요.');
    const shift=(match[2]||'').length-Number(match[3]||0);
    if(Math.abs(shift)>400)throw new Error('금액 범위를 초과했습니다.');
    return {n:BigInt(match[1]+(match[2]||''))*10n**BigInt(Math.max(0,-shift)),d:10n**BigInt(Math.max(0,shift))};
  }
  function roundRatio(n,d){return (n*2n+d)/(d*2n);}
  function safeMinor(n){if(n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('금액 범위를 초과했습니다.');return Number(n);}
  function parseLedgerInput(raw,currency) {
    const text=String(raw).trim();
    if(!text)throw new Error('금액을 입력해 주세요.');
    if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text))throw new Error('올바른 숫자를 입력해 주세요.');
    const clean=text.replace(/,/g,''),digits=(clean.split('.')[1]||'').length,places=LEDGER_CURRENCIES[currency].digits;
    if(digits>places)throw new Error(places===0?(LEDGER_CURRENCIES[currency].code==='KRW'?'원 단위로 입력해 주세요.':'정수로 입력해 주세요.'):places===2?'소수 둘째 자리까지 입력해 주세요.':'소수 '+places+'자리까지 입력해 주세요.');
    const {n,d}=decimalParts(clean),minor=n*LEDGER_CURRENCIES[currency].scale/d;
    if(minor<=0n)throw new Error('0보다 큰 금액을 입력해 주세요.');
    safeMinor(minor);
    const value=Number(clean),back=decimalParts(value);
    if(back.n*d!==n*back.d)throw new Error('금액 범위를 초과했습니다.');
    return value;
  }
  function parseLedgerRate(raw){
    const text=String(raw).trim();
    if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text))throw new Error('올바른 환율을 입력해 주세요.');
    const value=Number(text.replace(/,/g,''));
    if(!Number.isFinite(value)||value<=0)throw new Error('올바른 환율을 입력해 주세요.');
    return value;
  }
  function convertLedgerAmount(amount,source,rate) {
    if(!Number.isFinite(rate)||rate<=0)throw new Error('자동 계산에 사용할 환율을 확인해 주세요.');
    const a=decimalParts(amount),r=decimalParts(rate);
    const scale=LEDGER_CURRENCIES[source==='krw'?'usd':'krw'].scale;
    const minor=source==='krw'?roundRatio(a.n*r.d*scale,a.d*r.n):roundRatio(a.n*r.n*scale,a.d*r.d);
    const value=safeMinor(minor)/Number(scale),back=decimalParts(value);
    if(back.n*scale!==minor*back.d)throw new Error('금액 범위를 초과했습니다.');
    return value;
  }
  function ledgerSumParts(items,key){
    let n=0n,d=1n;
    for(const item of items){const part=decimalParts(item[key]);const scale=part.d>d?part.d:d;n=n*(scale/d)+part.n*(scale/part.d);d=scale;}
    return {n,d};
  }
  function sumLedgerAmounts(items,key){
    const {n,d}=ledgerSumParts(items,key);
    return Number(n)/Number(d);
  }
  function formatLedgerSum(items,currency){
    const {n,d}=ledgerSumParts(items,currency==='krw'?'amountKrw':'amountUsd');
    const minor=roundRatio(n*LEDGER_CURRENCIES[currency].scale,d);
    return formatCurrencyMinor(minor,currency);
  }
  function expenseMoney(item){return {amountKrw:item.amountKrw,amountUsd:item.amountUsd,amountSource:item.amountSource,appliedExchangeRate:item.appliedExchangeRate};}
  function emptyExpenseInput(){return {krw:'',usd:'',original:null,touched:false,composing:false};}
  function calculateExpenseInput(form,rate){
    if(form.original&&!form.touched)return {money:expenseMoney(form.original),errors:{}};
    const errors={},values={};
    for(const currency of ['krw','usd'])if(form[currency].trim())try{values[currency]=parseLedgerInput(form[currency],currency);}catch(error){errors[currency]=error.message;}
    const source=form.krw.trim()?(form.usd.trim()?'both':'krw'):(form.usd.trim()?'usd':null);
    if(!source)return {errors:{krw:currencyLabel('krw')+' 또는 '+currencyLabel('usd')+'를 입력해 주세요.'},empty:true};
    if(form.composing||Object.keys(errors).length)return {errors};
    try{
      const money={amountKrw:values.krw,amountUsd:values.usd,amountSource:source,appliedExchangeRate:source==='both'?null:rate};
      if(source==='krw')money.amountUsd=convertLedgerAmount(values.krw,'krw',rate);
      if(source==='usd')money.amountKrw=convertLedgerAmount(values.usd,'usd',rate);
      return {money,errors};
    }catch(error){return {errors:{[source]:error.message}};}
  }
  // End ledger arithmetic.
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
  function normalizeExpense(item,index,cats,rate,version) {
    const base={id:safeDataId(item?.id,'legacy-'+index+'-'+hashText(JSON.stringify(item||{}))),name:String(item?.name||'').trim().slice(0,80),date:/^\d{4}-\d{2}-\d{2}$/.test(item?.date||'')?item.date:'',categoryId:findCategoryId(item?.categoryId||item?.category||'misc',cats)};
    if(version>=6||['amountKrw','amountUsd','amountSource','appliedExchangeRate'].some(key=>Object.hasOwn(item||{},key))){
      const money=expenseMoney(item),source=money.amountSource;
      if(!['krw','usd','both'].includes(source))throw new Error('지출의 금액 출처를 복구해 주세요.');
      for(const [key,currency] of [['amountKrw','krw'],['amountUsd','usd']]){
        const value=money[key],automatic=source!=='both'&&source!==currency;
        if(typeof value!=='number'||!Number.isFinite(value)||value<0||(!automatic&&value===0))throw new Error('지출 금액을 복구해 주세요.');
        const part=decimalParts(value),scale=LEDGER_CURRENCIES[currency].scale;
        if(part.n*scale>BigInt(Number.MAX_SAFE_INTEGER)*part.d||((automatic||source==='both')&&part.n*scale%part.d!==0n))throw new Error('지출 금액 범위를 확인해 주세요.');
      }
      if(source==='both'?money.appliedExchangeRate!==null:typeof money.appliedExchangeRate!=='number'||!Number.isFinite(money.appliedExchangeRate)||money.appliedExchangeRate<=0)throw new Error('지출의 적용 환율을 복구해 주세요.');
      if(source!=='both'&&convertLedgerAmount(source==='krw'?money.amountKrw:money.amountUsd,source,money.appliedExchangeRate)!==(source==='krw'?money.amountUsd:money.amountKrw))throw new Error('지출의 자동 계산 금액을 복구해 주세요.');
      return {...base,...money};
    }
    const amount=Number(item?.amount),source=item?.currency==='KRW'?'krw':'usd';
    if(!Number.isFinite(amount)||amount<=0)throw new Error('기존 지출 금액을 복구해 주세요.');
    const part=decimalParts(amount);if(part.n*LEDGER_CURRENCIES[source].scale>BigInt(Number.MAX_SAFE_INTEGER)*part.d)throw new Error('기존 지출 금액 범위를 확인해 주세요.');
    const converted=convertLedgerAmount(amount,source,rate);
    return {...base,amountKrw:source==='krw'?amount:converted,amountUsd:source==='usd'?amount:converted,amountSource:source,appliedExchangeRate:rate};
  }
  function normalizeExpenses(input,cats,rate,version){
    if(input!==undefined&&!Array.isArray(input))throw new Error('지출 목록을 복구해 주세요.');
    const seen=new Set();return (input||[]).map((item,index)=>{const expense=normalizeExpense(item,index,cats,rate,version);if(seen.has(expense.id))expense.id+='-duplicate-'+index;seen.add(expense.id);return expense;});
  }
