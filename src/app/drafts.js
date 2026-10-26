  // A synchronous checkpoint covers navigation before an IndexedDB commit.
  // It uses the same per-page ownership/claim rules as the durable draft.
  function draftCheckpointKey(key){return DRAFT_DB_NAME+':checkpoint:'+key;}
  function readDraftCheckpoint(key){try{return JSON.parse(localStorage.getItem(draftCheckpointKey(key))||'null');}catch(_){return null;}}
  function removeDraftCheckpoint(key,expected){try{const storageKey=draftCheckpointKey(key);if(expected===undefined||localStorage.getItem(storageKey)===expected)localStorage.removeItem(storageKey);return true;}catch(_){return false;}}
  function openDraftDatabase() {
    if(draftDatabasePromise)return draftDatabasePromise;
    draftDatabasePromise=new Promise(resolve=>{
      if(!('indexedDB' in window)){resolve(null);return;}
      try{
        const request=indexedDB.open(DRAFT_DB_NAME,1);
        request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('records'))request.result.createObjectStore('records');};
        let blocked=false;
        request.onsuccess=()=>{if(blocked){request.result.close();return;}resolve(request.result);};
        request.onerror=()=>{console.warn('IndexedDB 초안 저장소를 열지 못했습니다.',request.error);resolve(null);};
        request.onblocked=()=>{blocked=true;resolve(null);};
      }catch(error){console.warn('IndexedDB 초안 저장소를 열지 못했습니다.',error);resolve(null);}
    }).then(database=>{
      if(!database)draftDatabasePromise=null;
      return database;
    });
    return draftDatabasePromise;
  }
  function showDraftStorageWarning(kind='') {
    let warning=$('#draftStorageWarning');
    if(!warning){warning=document.createElement('span');warning.id='draftStorageWarning';warning.className='chip';warning.setAttribute('role','alert');$('#status').after(warning);}
    warning.hidden=!kind;
    warning.textContent=kind==='delete'?'초안 삭제 실패 · 저장 공간을 확인한 뒤 다시 시도해 주세요.':kind==='read'?'브라우저 초안을 확인하지 못했습니다 · 저장 공간을 확인해 주세요.':kind?'초안 보관 실패 · 새로고침 전에 공유 저장하거나 내보내세요.':'';
  }
  // A live page owns its record until its Web Lock is released on unload.
  // Recovery only moves records whose owner is no longer open.
  function acquireDraftLock(key) {
    if(!navigator.locks)return Promise.resolve(null);
    return new Promise(resolve=>{
      navigator.locks.request(DRAFT_DB_NAME+':'+key,{ifAvailable:true},lock=>{
        if(!lock){resolve(null);return;}
        return new Promise(release=>resolve(release));
      }).catch(()=>resolve(null));
    });
  }
  function prepareDraftStorage() {
    if(draftStoragePromise)return draftStoragePromise;
    draftStoragePromise=(async()=>{
      const releaseOwn=await (draftLockPromise??=acquireDraftLock(DRAFT_RECORD_KEY));
      const database=await openDraftDatabase();
      if(!database)return false;
      try{
        let previousKey='';
        try{previousKey=sessionStorage.getItem(DRAFT_SESSION_KEY)||'';}catch(_){}
        // Without Web Locks keep writes isolated; never claim a possibly live draft.
        if(!releaseOwn)return true;
        const candidates=await new Promise((resolve,reject)=>{
          const entries=[],transaction=database.transaction('records','readonly'),request=transaction.objectStore('records').openCursor();
          request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const key=String(cursor.key),record=cursor.value;
            if((key===LEGACY_DRAFT_RECORD_KEY||key.startsWith(LEGACY_DRAFT_RECORD_KEY+':'))&&key!==DRAFT_RECORD_KEY&&record?.state?.html&&record.tripId===TRIP_ID)entries.push({key,savedAt:record.savedAt||''});
            cursor.continue();};
          transaction.oncomplete=()=>resolve(entries);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
        });
        try{
          const prefix=draftCheckpointKey(LEGACY_DRAFT_RECORD_KEY+':');
          for(let i=0;i<localStorage.length;i++){
            const storageKey=localStorage.key(i);if(!storageKey?.startsWith(prefix))continue;
            const key=storageKey.slice(draftCheckpointKey('').length),record=readDraftCheckpoint(key);
            if(key===DRAFT_RECORD_KEY||record?.tripId!==TRIP_ID||!record?.state?.html)continue;
            const existing=candidates.find(item=>item.key===key);
            if(existing)existing.savedAt=record.savedAt||existing.savedAt;else candidates.push({key,savedAt:record.savedAt||''});
          }
        }catch(_){}
        candidates.sort((a,b)=>Number(b.key===previousKey)-Number(a.key===previousKey)||b.savedAt.localeCompare(a.savedAt));
        for(const {key} of candidates){
          const release=await acquireDraftLock(key);if(!release)continue;
          let claimed=false;
          try{
            claimed=await new Promise((resolve,reject)=>{
              const transaction=database.transaction('records','readwrite'),records=transaction.objectStore('records'),request=records.get(key);let found=false;
              request.onsuccess=()=>{const checkpoint=readDraftCheckpoint(key),record=checkpoint&&(!request.result||checkpoint.savedAt>=request.result.savedAt)?checkpoint:request.result;if(!record)return;found=true;try{records.put(record,DRAFT_RECORD_KEY);records.delete(key);}catch(error){transaction.abort();reject(error);}};
              transaction.oncomplete=()=>resolve(found);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
            });
          }finally{release();}
          if(claimed){removeDraftCheckpoint(key);break;}
        }
        try{sessionStorage.setItem(DRAFT_SESSION_KEY,DRAFT_RECORD_KEY);}catch(_){}
        return true;
      }catch(error){console.warn('초안 저장소를 준비하지 못했습니다.',error);return false;}
    })().then(ready=>{draftStorageReady=ready;if(!ready)draftStoragePromise=null;return ready;});
    return draftStoragePromise;
  }
  async function writeDraftRecord(record) {
    if(documentSession.snapshot().documentWriteBlock)return false;
    if(deferredDraftRecovery)return false;
    const generation=++draftWriteGeneration;
    memoryDraftRecord=clone(record);
    const checkpoint=JSON.stringify(record);
    // Wait for ownership/recovery setup before creating this page's checkpoint.
    if(draftStorageReady)try{localStorage.setItem(draftCheckpointKey(DRAFT_RECORD_KEY),checkpoint);}catch(_){}
    let saved=false;
    try{
      if(!await prepareDraftStorage())throw new Error('Draft storage unavailable');
      const database=await openDraftDatabase();if(!database)throw new Error('Draft storage unavailable');
      if(generation!==draftWriteGeneration)return false;
      saved=await new Promise(resolve=>{
        const transaction=database.transaction('records','readwrite');
        transaction.oncomplete=()=>resolve(generation===draftWriteGeneration);
        transaction.onerror=()=>{console.warn('초안을 저장하지 못했습니다.',transaction.error);resolve(false);};
        transaction.onabort=()=>resolve(false);
        transaction.objectStore('records').put(record,DRAFT_RECORD_KEY);
      });
    }catch(error){console.warn('초안을 저장하지 못했습니다.',error);}
    if(saved)removeDraftCheckpoint(DRAFT_RECORD_KEY,checkpoint);
    if(generation===draftWriteGeneration)showDraftStorageWarning(saved?'':'write');
    return saved;
  }
  async function readDraftRecord() {
    // A failed write leaves newer edits in memory than the durable record.
    if(memoryDraftRecord)return clone(memoryDraftRecord);
    try{
      if(!await prepareDraftStorage())throw new Error('Draft storage unavailable');
      const database=await openDraftDatabase();if(!database)throw new Error('Draft storage unavailable');
      return await new Promise((resolve,reject)=>{
        const transaction=database.transaction('records','readonly');
        const request=transaction.objectStore('records').get(DRAFT_RECORD_KEY);
        request.onsuccess=()=>resolve(request.result||null);
        request.onerror=()=>reject(request.error);
        transaction.onabort=()=>reject(transaction.error);
      });
    }catch(error){console.warn('초안을 읽지 못했습니다.',error);showDraftStorageWarning('read');return null;}
  }
  async function clearDraftRecord() {
    if(documentSession.snapshot().documentWriteBlock)return false;
    const generation=++draftWriteGeneration;clearTimeout(draftWriteTimer);draftWriteTimer=null;
    let cleared=false;
    try{
      if(!await prepareDraftStorage())throw new Error('Draft storage unavailable');
      const database=await openDraftDatabase();if(!database)throw new Error('Draft storage unavailable');
      const deleted=await new Promise(resolve=>{
        const transaction=database.transaction('records','readwrite');
        transaction.oncomplete=()=>resolve(true);transaction.onerror=()=>resolve(false);transaction.onabort=()=>resolve(false);
        transaction.objectStore('records').delete(DRAFT_RECORD_KEY);
      });
      if(deleted)cleared=await new Promise(resolve=>{
        const transaction=database.transaction('records','readonly');
        const request=transaction.objectStore('records').get(DRAFT_RECORD_KEY);
        request.onsuccess=()=>resolve(!request.result);request.onerror=()=>resolve(false);
        transaction.onabort=()=>resolve(false);
      });
    }catch(error){console.warn('초안을 삭제하지 못했습니다.',error);}
    if(generation!==draftWriteGeneration)return false;
    if(cleared)cleared=removeDraftCheckpoint(DRAFT_RECORD_KEY);
    if(cleared){deferredDraftRecovery=false;memoryDraftRecord=null;}
    showDraftStorageWarning(cleared?'':'delete');
    return cleared;
  }
  async function writePublicCache(state,metadata={}) {
    const record={
      state:clone(state),
      revision:Math.max(0,Number(metadata.revision??documentSession.snapshot().publishedRevision)||0),
      updatedAt:String(metadata.updatedAt??documentSession.snapshot().publishedUpdatedAt??''),
      cachedAt:String(metadata.cachedAt||new Date().toISOString())
    };
    memoryPublicCache=clone(record);
    const database=await openDraftDatabase();if(!database)return false;
    return new Promise(resolve=>{
      const transaction=database.transaction('records','readwrite');
      transaction.objectStore('records').put(record,PUBLIC_CACHE_RECORD_KEY);
      transaction.oncomplete=()=>{try{localStorage.removeItem(LEGACY_CACHE_KEY);}catch(_){}resolve(true);};
      transaction.onerror=()=>{console.warn('공개본 캐시를 저장하지 못했습니다.',transaction.error);resolve(false);};
      transaction.onabort=()=>resolve(false);
    });
  }
  async function readPublicCache() {
    const database=await openDraftDatabase();
    if(database){
      const stored=await new Promise(resolve=>{
        const transaction=database.transaction('records','readonly');
        const request=transaction.objectStore('records').get(PUBLIC_CACHE_RECORD_KEY);
        request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>resolve(null);
      });
      if(stored?.state?.html){memoryPublicCache=clone(stored);return stored;}
    }
    if(memoryPublicCache?.state?.html)return clone(memoryPublicCache);
    try{
      const parsed=JSON.parse(localStorage.getItem(LEGACY_CACHE_KEY)||'null');
      const legacy=parsed?.state?.html?parsed:parsed?.html?{state:parsed,revision:0,updatedAt:'',cachedAt:''}:null;
      if(legacy){memoryPublicCache=clone(legacy);void writePublicCache(legacy.state,legacy);return legacy;}
    }catch(error){console.warn('기존 공개본 캐시를 읽지 못했습니다.',error);}
    return null;
  }
  function setPublishedBaseline(row,state,cacheMetadata={}) {
    const normalized=normalizeState(state),current=normalizeState(captureState());
    documentSession.acceptPublished(row,fingerprint(current)===fingerprint(normalized)?normalized:current);
    void writePublicCache(documentSession.snapshot().lastSavedState,cacheMetadata);
  }
  function currentDraftRecord() {
    return {tripId:TRIP_ID,schemaVersion:SCHEMA_VERSION,state:documentSession.snapshot().previewReturnState?clone(documentSession.snapshot().previewReturnState):captureState(),baseState:documentSession.snapshot().draftBaselineUnknown?null:clone(documentSession.snapshot().lastSavedState),baseRevision:documentSession.snapshot().publishedRevision,baseUpdatedAt:documentSession.snapshot().publishedUpdatedAt,savedAt:new Date().toISOString(),dirty:true};
  }
  async function flushDraftPersistence() {
    clearTimeout(draftWriteTimer);
    if(!documentSession.snapshot().lastSavedState||!isDirty())return false;
    return writeDraftRecord(currentDraftRecord());
  }
  function queueDraftPersistence() {
    clearTimeout(draftWriteTimer);
    if(!documentSession.snapshot().pendingDraft||!documentSession.snapshot().lastSavedState||body.classList.contains('hydrating'))return;
    draftWriteTimer=setTimeout(()=>{
      if(documentSession.snapshot().pendingDraft)void writeDraftRecord(currentDraftRecord());
    },700);
  }

  function clearCleanDraft() {
    if(deferredDraftRecovery)return;
    // Offline saved changes live in IndexedDB too. Keep their clean baseline
    // rather than reverting to the file's older embedded state on reload.
    draftWriteGeneration++;clearTimeout(draftWriteTimer);draftWriteTimer=null;
    if(OFFLINE_MODE)void writeDraftRecord({...currentDraftRecord(),dirty:false});
    else void clearDraftRecord();
  }
