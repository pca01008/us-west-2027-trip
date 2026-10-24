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
