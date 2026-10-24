  function todayLocal() { const now=new Date(); return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10); }
  function formatKrw(value) { return formatCurrencyAmount(value,'krw'); }
  function formatUsd(value) { return formatCurrencyAmount(value,'usd'); }
  function iconSvg(name) { return '<span class="button-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + (ICONS[name] || ICONS.plus) + '</svg></span>'; }
  function decorateButtonIcons(root=document) {
    root.querySelectorAll('button[data-icon]').forEach(button => {
      if (!button.querySelector('.button-icon')) button.insertAdjacentHTML('afterbegin', iconSvg(button.dataset.icon));
    });
  }
  function setOperationBusy(on,{cancelable=false,status=''}={}) {
    if(on&&!operationBusy)operationController=new AbortController();
    if(!on){operationController?.abort();operationController=null;}
    operationBusy=on;operationCancelled=false;body.classList.toggle('operation-busy',on);
    const cancel=$('#cancelOperationBtn');if(cancel){cancel.classList.toggle('hidden',!on||!cancelable);cancel.disabled=!on||!cancelable;}
    $('.editor-bar')?.setAttribute('aria-busy',String(on));
    if(status)setStatus(status);
    if(!on){updateHistoryControls();updateDirtyState();}
  }
  function cancelCurrentOperation(){const button=$('#cancelOperationBtn');if(!operationBusy||!button||button.disabled)return;operationCancelled=true;operationController?.abort(new Error('작업을 취소했습니다. 초안은 유지됩니다.'));button.disabled=true;setStatus('작업을 취소하는 중입니다.');}
  function focusAndSelect(element){element?.focus();const selection=window.getSelection();if(!selection||!element)return;const range=document.createRange();range.selectNodeContents(element);selection.removeAllRanges();selection.addRange(range);}
  function insertPlainText(target,text){
    try{if(typeof document.execCommand==='function'&&document.execCommand('insertText',false,text))return;}catch(error){console.debug('기본 텍스트 삽입을 사용할 수 없습니다.',error);}
    const selection=window.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):document.createRange();
    if(!target.contains(range.commonAncestorContainer)){range.selectNodeContents(target);range.collapse(false);}
    range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);
    selection?.removeAllRanges();selection?.addRange(range);
    const inputEvent=typeof InputEvent==='function'?new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}):new Event('input',{bubbles:true});
    target.dispatchEvent(inputEvent);
  }
