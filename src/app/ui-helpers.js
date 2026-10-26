  function todayLocal() { const now=new Date(); return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10); }
  function formatKrw(value) { return formatCurrencyAmount(value,'krw'); }
  function formatUsd(value) { return formatCurrencyAmount(value,'usd'); }
  function iconSvg(name) { return '<span class="button-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + (ICONS[name] || ICONS.plus) + '</svg></span>'; }
  function decorateButtonIcons(root=document) {
    root.querySelectorAll('button[data-icon]').forEach(button => {
      if (!button.querySelector('.button-icon')) button.insertAdjacentHTML('afterbegin', iconSvg(button.dataset.icon));
    });
  }


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
function isOperationBusy(){return operationBusy;}
function isOperationCancelled(){return operationCancelled;}
function currentOperationSignal(){return operationController?.signal;}

function showDraftStorageWarning(kind='') {
    let warning=$('#draftStorageWarning');
    if(!warning){warning=document.createElement('span');warning.id='draftStorageWarning';warning.className='chip';warning.setAttribute('role','alert');$('#status').after(warning);}
    warning.hidden=!kind;
    warning.textContent=kind==='delete'?'초안 삭제 실패 · 저장 공간을 확인한 뒤 다시 시도해 주세요.':kind==='read'?'브라우저 초안을 확인하지 못했습니다 · 저장 공간을 확인해 주세요.':kind?'초안 보관 실패 · 새로고침 전에 공유 저장하거나 내보내세요.':'';
  }
function fingerprint(state){return JSON.stringify(normalizeState(state||{}));}
