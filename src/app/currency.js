  // Storage slots keep their historical krw/usd names. Schema 7 binds them to
  // explicit base/quote codes; schema 6 always means KRW/USD.
  function createLedgerCurrencies(config) {
    const pair=config.ledger?.currencies||{base:'KRW',quote:'USD'};
    const codes=[pair.base,pair.quote];
    if(codes.some(code=>!Intl.supportedValuesOf('currency').includes(code))||codes[0]===codes[1])throw new Error('서로 다른 올바른 통화 코드를 설정해 주세요.');
    if(Number(config.schemaVersion)<7&&(codes[0]!=='KRW'||codes[1]!=='USD'))throw new Error('다른 통화는 새 여행의 schemaVersion 7 설정을 사용해 주세요.');
    const labels={KRW:'원화',USD:'달러',JPY:'엔화',EUR:'유로',GBP:'파운드',CNY:'위안'};
    return Object.fromEntries(codes.map((code,index)=>{
      const formatter=new Intl.NumberFormat('en-US',{style:'currency',currency:code});
      const digits=formatter.resolvedOptions().maximumFractionDigits;
      return [index?'usd':'krw',{code,label:labels[code]||new Intl.DisplayNames([config.locale||'ko-KR'],{type:'currency'}).of(code),
        symbol:code==='KRW'?'₩':formatter.formatToParts(0).find(part=>part.type==='currency').value,
        digits,scale:10n**BigInt(digits)}];
    }));
  }
  const LEDGER_CURRENCIES=createLedgerCurrencies(CONFIG);
  const CURRENCY_CODES={base:LEDGER_CURRENCIES.krw.code,quote:LEDGER_CURRENCIES.usd.code};
  function currencyMetadata(){return Number(CONFIG.schemaVersion)>=7?{currencyCodes:{...CURRENCY_CODES}}:{};}
  function assertCurrencyPair(raw){
    // Unstamped legacy documents can only be interpreted as the legacy pair.
    const codes=raw?.currencyCodes||(Number(raw?.schemaVersion||0)<7?{base:'KRW',quote:'USD'}:null);
    if(!codes||codes.base!==CURRENCY_CODES.base||codes.quote!==CURRENCY_CODES.quote){
      const error=new Error('저장본과 여행 설정의 통화가 다릅니다. 기존 통화를 복구하거나 새 여행으로 시작해 주세요.');
      error.code='DOCUMENT_CURRENCY';throw error;
    }
  }
  function currencyLabel(slot){return LEDGER_CURRENCIES[slot].label;}
  function formatCurrencyMinor(minor,slot){
    const {symbol,digits,scale}=LEDGER_CURRENCIES[slot];
    return symbol+(minor/scale).toLocaleString(slot==='krw'?'ko-KR':'en-US')+(digits?'.'+String(minor%scale).padStart(digits,'0'):'');
  }
  function formatCurrencyAmount(value,slot){
    const part=decimalParts(Number(value)||0);
    return formatCurrencyMinor(roundRatio(part.n*LEDGER_CURRENCIES[slot].scale,part.d),slot);
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
