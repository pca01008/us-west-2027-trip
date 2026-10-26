function createNavigationController({$,$$,body,iconSvg,isOperationBusy,isTimetableActive,syncScheduleView}) {
let lastScheduleDay = 'd1';
let tabScrollReleaseTimer = null;
let tabScrollReleaseHandler = null;
  function prefersReducedMotion(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  function tabAnchorTop(tabs){const header=$('header'),headerBottom=header?header.getBoundingClientRect().bottom+window.scrollY:0,marginTop=Number.parseFloat(getComputedStyle(tabs).marginTop)||0;return Math.max(0,Math.round(headerBottom+marginTop));}
  function tabsArePinned(tabs){const stickyTop=Number.parseFloat(getComputedStyle(tabs).top)||0;return tabs.getBoundingClientRect().top<=stickyTop+1;}
  function cancelTabScrollRelease(){clearTimeout(tabScrollReleaseTimer);tabScrollReleaseTimer=null;if(tabScrollReleaseHandler){window.removeEventListener('scrollend',tabScrollReleaseHandler);tabScrollReleaseHandler=null;}}
  function holdMainHeight(){const main=$('main');if(main)main.style.setProperty('min-height',Math.ceil(main.getBoundingClientRect().height)+'px','important');}
  function releaseMainHeight(){cancelTabScrollRelease();$('main')?.style.removeProperty('min-height');}
  function alignPageToTabs(tabs){
    const target=tabAnchorTop(tabs),behavior=prefersReducedMotion()?'auto':'smooth';
    if(behavior==='auto'||Math.abs(window.scrollY-target)<=1){window.scrollTo({top:target,behavior:'auto'});requestAnimationFrame(releaseMainHeight);return;}
    const finish=()=>releaseMainHeight();
    tabScrollReleaseHandler=finish;window.addEventListener('scrollend',finish,{once:true});tabScrollReleaseTimer=setTimeout(finish,900);
    window.scrollTo({top:target,behavior});
  }
  function scrollTabs(direction){const tabs=$('.tabs');tabs.scrollBy({left:direction*Math.min(480,tabs.clientWidth*.72),behavior:prefersReducedMotion()?'auto':'smooth'});}
  function revealSelectedTab(behavior=prefersReducedMotion()?'auto':'smooth'){
    const tabs=$('.tabs'),selected=$('.day-radio:checked'),label=selected?$('label[for="'+selected.id+'"]'):null;if(!tabs||!label)return;
    const target=label.offsetLeft-(tabs.clientWidth-label.offsetWidth)/2,maximum=Math.max(0,tabs.scrollWidth-tabs.clientWidth);
    tabs.scrollTo({left:Math.max(0,Math.min(target,maximum)),behavior});
  }

function updateEditButton(){const button=$('#editBtn'),money=$('.day-radio:checked')?.id==='money',editing=body.classList.contains('editing'),icon=editing?'check':money?'settings':'edit',label=editing?'편집 완료':money?'가계부 설정':$('.day-radio:checked')?.id==='prep'?'목록 편집':'편집 시작';button.dataset.icon=icon;button.innerHTML=iconSvg(icon)+label;}

function syncSelectedPanel(){const id=$('.day-radio:checked')?.id||'prep',selector=id==='prep'?'.prepday':id==='money'?'.moneyday':/^d\d+$/.test(id)?'.day'+id.slice(1):'.prepday';$$('main .panel.day').forEach(panel=>{const active=panel.matches(selector),panelId=panel.classList.contains('prepday')?'prep':panel.classList.contains('moneyday')?'money':'d'+(Array.from(panel.classList).find(name=>/^day\d+$/.test(name))||'day1').slice(3);panel.id='panel-'+panelId;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-'+panelId);panel.setAttribute('aria-hidden',String(!active));panel.classList.toggle('is-active',active);});$$('.tabs label[for]').forEach(label=>{const active=label.htmlFor===id;label.id='tab-'+label.htmlFor;label.setAttribute('role','tab');label.setAttribute('aria-controls','panel-'+label.htmlFor);label.setAttribute('aria-selected',String(active));label.tabIndex=active?0:-1;label.classList.toggle('is-active',active);});}

function updateContextControls(){const id=$('.day-radio:checked')?.id||'';if(/^d\d+$/.test(id))lastScheduleDay=id;syncSelectedPanel();$$('.bottom-nav button').forEach(button=>{const active=button.dataset.section===(/^d\d+$/.test(id)?'schedule':id);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});$('#addTimeBtn').classList.toggle('hidden',!/^d\d+$/.test(id));$('#addCheckBtn').classList.add('hidden');updateEditButton();syncScheduleView();}
function bindNavigationControls(){
$('#tabsPrev').onclick=()=>scrollTabs(-1);
$('#tabsNext').onclick=()=>scrollTabs(1);
document.addEventListener('change',async event=>{if(event.target.matches('.day-radio')){const tabs=$('.tabs'),keepTabsPinned=Boolean(tabs&&tabsArePinned(tabs));cancelTabScrollRelease();if(keepTabsPinned)holdMainHeight();else releaseMainHeight();updateContextControls();revealSelectedTab();if(keepTabsPinned)requestAnimationFrame(()=>alignPageToTabs(tabs));}});
$('.bottom-nav').addEventListener('click',event=>{
    const button=event.target.closest('[data-section]');if(!button||isOperationBusy())return;
    button.focus({preventScroll:true});
    const id=button.dataset.section==='schedule'?lastScheduleDay:button.dataset.section,radio=document.getElementById(id);
    if(!radio||radio.checked)return;
    cancelTabScrollRelease();releaseMainHeight();radio.checked=true;updateContextControls();revealSelectedTab('auto');
    const content=$('#scheduleViewSwitch').hidden?$('main'):$('#scheduleViewSwitch');content.scrollIntoView({block:'start',behavior:'instant'});
  });
$('.tabs').addEventListener('click',event=>{
    const tab=event.target.closest('label[for]'),radio=tab?document.getElementById(tab.htmlFor):null;
    if(!radio?.matches('.day-radio'))return;
    event.preventDefault();tab.focus({preventScroll:true});
    if(!radio.checked)radio.click();
    else if(isTimetableActive())radio.dispatchEvent(new Event('change',{bubbles:true}));
  });
$('.tabs').addEventListener('keydown',event=>{const current=event.target.closest('[role="tab"]');if(!current)return;const tabs=$$('.tabs [role="tab"]'),index=tabs.indexOf(current);let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else if(event.key==='Enter'||event.key===' '){event.preventDefault();current.click();return;}else return;event.preventDefault();tabs[next].click();tabs[next].focus({preventScroll:true});});
$('.tabs').addEventListener('wheel',event=>{const tabs=event.currentTarget;if(tabs.scrollWidth<=tabs.clientWidth||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;event.preventDefault();tabs.scrollLeft+=event.deltaY;},{passive:false});
}

function rememberScheduleDay(id){lastScheduleDay=id;}
return Object.freeze({rememberScheduleDay,prefersReducedMotion,tabAnchorTop,tabsArePinned,cancelTabScrollRelease,holdMainHeight,releaseMainHeight,alignPageToTabs,scrollTabs,revealSelectedTab,updateEditButton,syncSelectedPanel,updateContextControls,bindNavigationControls});
}
