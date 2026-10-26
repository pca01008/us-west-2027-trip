/** Dialog stack, choice resolution and focus restoration; no document I/O. */
function createDialogs({$, $$, body}) {
  let noticeResolver=null, noticeInputValue='', countdownTimer=null, observer=null, keyHandler=null;
  const dialogFocusOrigins=new WeakMap(), openDialogStack=[];
function closeNotice(result){const field=$('#noticeField');noticeInputValue=!field.hidden?$('#noticeInput').value.trim():'';$('#noticeDialog').hidden=true;$('#sessionCountdown').hidden=true;field.hidden=true;clearInterval(countdownTimer);const resolve=noticeResolver;noticeResolver=null;if(resolve)resolve(result);}

function showChoice({title,message,choices,countdown=false,input=null}){if(noticeResolver)closeNotice('replaced');noticeInputValue='';$('#noticeTitle').textContent=title;$('#noticeMessage').textContent=message;const field=$('#noticeField');field.hidden=!input;if(input){$('#noticeFieldLabel').textContent=input.label||'메모';$('#noticeInput').value=input.value||'';$('#noticeInput').placeholder=input.placeholder||'';}const actions=$('#noticeActions');actions.innerHTML='';choices.forEach(choice=>{const b=document.createElement('button');b.type='button';b.textContent=choice.label;b.className=choice.className||'action-muted';b.onclick=()=>closeNotice(choice.value);actions.appendChild(b);});$('#sessionCountdown').hidden=!countdown;showDialog($('#noticeDialog'));if(input)setTimeout(()=>$('#noticeInput').focus(),0);return new Promise(resolve=>noticeResolver=resolve);}

function focusableIn(dialog){return $$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])').filter(element=>dialog.contains(element)&&!element.hidden&&element.getClientRects().length);}

function setFieldError(id,message=''){const input=$('#'+id),error=$('#'+id+'Error');input.setAttribute('aria-invalid',message?'true':'false');error.textContent=message;error.hidden=!message;}

function rememberDialogOrigin(dialog){
    const element=document.activeElement;
    const action=['data-edit-expense','data-category-edit','data-media','data-edit-photo'].find(name=>element?.hasAttribute(name));
    const scope=element?.closest('[role="dialog"],[data-row-id],[data-photo-id]');
    const scopeSelector=scope?.id?'#'+CSS.escape(scope.id):scope?.hasAttribute('data-photo-id')?'[data-photo-id="'+CSS.escape(scope.dataset.photoId)+'"]':scope?.hasAttribute('data-row-id')?'[data-row-id="'+CSS.escape(scope.dataset.rowId)+'"]':'';
    const selector=element?.id?'#'+CSS.escape(element.id):action?scopeSelector+' ['+action+'="'+CSS.escape(element.getAttribute(action))+'"]':null;
    dialogFocusOrigins.set(dialog,{element,selector});
  }

function showDialog(dialog){openDialogStack.filter(item=>item.hidden).reverse().forEach(registerDialogState);if(dialog.hidden)rememberDialogOrigin(dialog);dialog.hidden=false;registerDialogState(dialog);}

function closeTopDialog(dialog){const closeId={checklistDialog:'checklistCancel',authDialog:'authCancel',versionDialog:'closeVersionsBtn',versionCompareDialog:'versionCompareClose',categoryDialog:'categoryCancel',ledgerSettingsDialog:'ledgerSettingsClose',expenseDialog:'expenseEditCancel',scheduleTimeDialog:'scheduleTimeCancel',mapDialog:'mapCancel',photoEditDialog:'photoEditCancel',importDialog:'importCancel',exportDialog:'exportCancel',photoViewer:'photoViewerClose',timetableDetail:'timetableDetailClose'}[dialog.id];if(dialog.id==='noticeDialog'){closeNotice($('#sessionCountdown').hidden?'cancel':'continue');return;}if(closeId)$('#'+closeId)?.click();}

function registerDialogState(dialog){
    if(!dialog.hidden){if(!openDialogStack.includes(dialog)){if(!dialogFocusOrigins.has(dialog))rememberDialogOrigin(dialog);openDialogStack.push(dialog);}body.classList.add('modal-open');requestAnimationFrame(()=>{if(!dialog.hidden&&openDialogStack.at(-1)===dialog&&!dialog.contains(document.activeElement)){const focusable=focusableIn(dialog);(focusable[0]||dialog).focus();}});return;}
    const index=openDialogStack.lastIndexOf(dialog);if(index<0)return;const wasTop=index===openDialogStack.length-1;openDialogStack.splice(index,1);body.classList.toggle('modal-open',openDialogStack.length>0);
    const saved=dialogFocusOrigins.get(dialog);dialogFocusOrigins.delete(dialog);if(!wasTop)return;
    const next=openDialogStack.at(-1),origin=saved?.element?.isConnected?saved.element:saved?.selector?$(saved.selector):null;
    if(origin instanceof HTMLElement&&origin.getClientRects().length&&(!next||next.contains(origin)))origin.focus();
    else if(next){const focusable=focusableIn(next);(focusable[0]||next).focus();}
  }

function initializeDialogAccessibility(){
    if(observer)return;
    const dialogs=$$('[role="dialog"]');dialogs.forEach(dialog=>{if(!dialog.hasAttribute('tabindex'))dialog.tabIndex=-1;});
    observer=new MutationObserver(records=>records.forEach(record=>registerDialogState(record.target)));dialogs.forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['hidden']}));
    keyHandler=event=>{const dialog=openDialogStack.at(-1);if(!dialog)return;if(event.key==='Escape'){event.preventDefault();closeTopDialog(dialog);return;}if(event.key!=='Tab')return;const focusable=focusableIn(dialog);if(!focusable.length){event.preventDefault();dialog.focus();return;}const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}};
    document.addEventListener('keydown',keyHandler,true);
  }
  function startNoticeCountdown() {
    let seconds=60;const countdown=$('#sessionCountdown');
    countdown.textContent=seconds+'초 후 자동 로그아웃됩니다.';
    countdownTimer=setInterval(()=>{seconds--;countdown.textContent=Math.max(0,seconds)+'초 후 자동 로그아웃됩니다.';},1000);
  }
  function clearCountdown(){clearInterval(countdownTimer);}
  function dispose(){observer?.disconnect();if(keyHandler)document.removeEventListener('keydown',keyHandler,true);clearCountdown();}
  return Object.freeze({closeNotice,showChoice,focusableIn,setFieldError,rememberDialogOrigin,showDialog,closeTopDialog,registerDialogState,initializeDialogAccessibility,startNoticeCountdown,clearCountdown,dispose,inputValue:()=>noticeInputValue});
}
