/** Dialog stack, choice resolution and focus restoration; no document I/O. */
function createDialogs({$, $$, body}) {
  let noticeResolver=null, noticeInputValue='', countdownTimer=null, observer=null;
  const dialogFocusOrigins=new WeakMap(), openDialogStack=[];
  const backgroundInert=new Map();
function closeNotice(result){const field=$('#noticeField');noticeInputValue=!field.hidden?$('#noticeInput').value.trim():'';$('#noticeDialog').hidden=true;$('#sessionCountdown').hidden=true;field.hidden=true;clearInterval(countdownTimer);const resolve=noticeResolver;noticeResolver=null;if(resolve)resolve(result);}

function showChoice({title,message,choices,countdown=false,input=null}){if(noticeResolver)closeNotice('replaced');noticeInputValue='';$('#noticeTitle').textContent=title;$('#noticeMessage').textContent=message;const field=$('#noticeField');field.hidden=!input;if(input){$('#noticeFieldLabel').textContent=input.label||'메모';$('#noticeInput').value=input.value||'';$('#noticeInput').placeholder=input.placeholder||'';}const actions=$('#noticeActions');actions.innerHTML='';choices.forEach(choice=>{const b=document.createElement('button');b.type='button';b.textContent=choice.label;b.className=choice.className||'action-muted';b.onclick=()=>closeNotice(choice.value);actions.appendChild(b);});$('#sessionCountdown').hidden=!countdown;showDialog($('#noticeDialog'));if(input)setTimeout(()=>$('#noticeInput').focus(),0);return new Promise(resolve=>noticeResolver=resolve);}

function focusableIn(dialog){
    return Array.from(dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]'))
      .filter(element=>element.tabIndex>=0&&!element.matches(':disabled')&&!element.closest('[inert]')&&element.getClientRects().length);
  }

function setFieldError(id,message=''){const input=$('#'+id),error=$('#'+id+'Error');input.setAttribute('aria-invalid',message?'true':'false');error.textContent=message;error.hidden=!message;}

function rememberDialogOrigin(dialog){
    const element=document.activeElement;
    const action=['data-edit-expense','data-category-edit','data-media','data-edit-photo'].find(name=>element?.hasAttribute(name));
    const scope=element?.closest('[role="dialog"],[data-row-id],[data-photo-id]');
    const scopeSelector=scope?.id?'#'+CSS.escape(scope.id):scope?.hasAttribute('data-photo-id')?'[data-photo-id="'+CSS.escape(scope.dataset.photoId)+'"]':scope?.hasAttribute('data-row-id')?'[data-row-id="'+CSS.escape(scope.dataset.rowId)+'"]':'';
    const selector=element?.id?'#'+CSS.escape(element.id):action?scopeSelector+' ['+action+'="'+CSS.escape(element.getAttribute(action))+'"]':null;
    const parent=element?.closest('[role="dialog"]');
    dialogFocusOrigins.set(dialog,{element,selector,fallback:dialogFocusOrigins.get(parent)});
  }

function setInertAttribute(element,value){
    if(value===null)element.removeAttribute('inert');
    else element.setAttribute('inert',value);
  }

function activeDialog(){return openDialogStack.findLast(dialog=>!dialog.hidden);}

function updateDialogBackground(dialog=activeDialog()){
    // Modal sections are siblings in the app shell, including stacked dialogs.
    const background=new Set(dialog?Array.from(body.children).filter(element=>element!==dialog&&!['SCRIPT','STYLE','TEMPLATE'].includes(element.tagName)):[]);
    for(const [element,previous] of backgroundInert){
      if(background.has(element))continue;
      setInertAttribute(element,previous);backgroundInert.delete(element);
    }
    for(const element of background){
      if(backgroundInert.has(element))continue;
      backgroundInert.set(element,element.getAttribute('inert'));
      element.inert=true;
    }
    body.classList.toggle('modal-open',Boolean(dialog));
  }

function focusDialog(dialog){
    (focusableIn(dialog)[0]||dialog).focus();
  }

function removeClosedDialogs(){
    const previous=openDialogStack.at(-1);
    let saved;
    for(let index=openDialogStack.length-1;index>=0;index--){
      const dialog=openDialogStack[index];
      if(!dialog.hidden)continue;
      if(index===openDialogStack.length-1)saved=dialogFocusOrigins.get(dialog);
      openDialogStack.splice(index,1);dialogFocusOrigins.delete(dialog);
    }
    const next=openDialogStack.at(-1);
    if(previous===next)return;
    updateDialogBackground();
    for(let entry=saved;entry;entry=entry.fallback){
      const origin=entry.element?.isConnected?entry.element:entry.selector?$(entry.selector):null;
      if(origin instanceof HTMLElement&&origin.getClientRects().length&&(!next||next.contains(origin))){
        origin.focus();if(document.activeElement===origin)return;
      }
    }
    if(next)focusDialog(next);
  }

function showDialog(dialog){
    removeClosedDialogs();
    if(dialog.hidden)rememberDialogOrigin(dialog);
    dialog.hidden=false;
    registerDialogState(dialog);
  }

function closeTopDialog(dialog){const closeId={checklistDialog:'checklistCancel',authDialog:'authCancel',versionDialog:'closeVersionsBtn',versionCompareDialog:'versionCompareClose',categoryDialog:'categoryCancel',ledgerSettingsDialog:'ledgerSettingsClose',expenseDialog:'expenseEditCancel',scheduleTimeDialog:'scheduleTimeCancel',mapDialog:'mapCancel',photoEditDialog:'photoEditCancel',importDialog:'importCancel',exportDialog:'exportCancel',photoViewer:'photoViewerClose',timetableDetail:'timetableDetailClose'}[dialog.id];if(dialog.id==='noticeDialog'){closeNotice($('#sessionCountdown').hidden?'cancel':'continue');return;}if(closeId)$('#'+closeId)?.click();}

function registerDialogState(dialog){
    if(dialog.hidden){removeClosedDialogs();return;}
    if(openDialogStack.includes(dialog))return;
    if(!dialogFocusOrigins.has(dialog))rememberDialogOrigin(dialog);
    openDialogStack.push(dialog);updateDialogBackground();
    requestAnimationFrame(()=>{
      if(activeDialog()===dialog&&!dialog.contains(document.activeElement))focusDialog(dialog);
    });
  }

function guardDialogFocus(event){
    const dialog=activeDialog();
    if(dialog&&!dialog.contains(event.target))focusDialog(dialog);
  }

function handleDialogKey(event){
    const dialog=activeDialog();if(!dialog)return;
    if(event.key==='Escape'){event.preventDefault();closeTopDialog(dialog);return;}
    if(event.key!=='Tab')return;
    const focusable=focusableIn(dialog),first=focusable[0],last=focusable.at(-1),active=document.activeElement;
    if(!focusable.includes(active)||(event.shiftKey?active===first:active===last)){
      event.preventDefault();((event.shiftKey?last:first)||dialog).focus();
    }
  }

function initializeDialogAccessibility(){
    if(observer)return;
    const dialogs=$$('[role="dialog"]');dialogs.forEach(dialog=>{if(!dialog.hasAttribute('tabindex'))dialog.tabIndex=-1;});
    observer=new MutationObserver(records=>{
      removeClosedDialogs();
      for(const record of records)if(record.type==='attributes')registerDialogState(record.target);
      if(records.some(record=>record.type==='childList'))updateDialogBackground();
    });
    dialogs.forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['hidden']}));
    observer.observe(body,{childList:true});
    document.addEventListener('keydown',handleDialogKey,true);
    document.addEventListener('focusin',guardDialogFocus,true);
  }
  function clonePageForExport(){
    const page=document.documentElement.cloneNode(true),clonedChildren=page.querySelector('body').children;
    Array.from(body.children).forEach((element,index)=>{
      if(backgroundInert.has(element))setInertAttribute(clonedChildren[index],backgroundInert.get(element));
    });
    page.querySelectorAll('[role="dialog"]').forEach(dialog=>dialog.hidden=true);
    return page;
  }
  function startNoticeCountdown() {
    let seconds=60;const countdown=$('#sessionCountdown');
    countdown.textContent=seconds+'초 후 자동 로그아웃됩니다.';
    countdownTimer=setInterval(()=>{seconds--;countdown.textContent=Math.max(0,seconds)+'초 후 자동 로그아웃됩니다.';},1000);
  }
  function clearCountdown(){clearInterval(countdownTimer);}
  function dispose(){
    observer?.disconnect();observer=null;openDialogStack.length=0;updateDialogBackground();
    document.removeEventListener('keydown',handleDialogKey,true);document.removeEventListener('focusin',guardDialogFocus,true);clearCountdown();
  }
  return Object.freeze({clonePageForExport,closeNotice,showChoice,focusableIn,setFieldError,rememberDialogOrigin,showDialog,closeTopDialog,registerDialogState,initializeDialogAccessibility,startNoticeCountdown,clearCountdown,dispose,inputValue:()=>noticeInputValue});
}
