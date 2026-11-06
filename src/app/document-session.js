/** Single owner of publication, preview, dirty and undo transitions. */
function createDocumentSession({clone, normalize, fingerprint, historyDelay=()=>400}) {
  let lastSavedState=null, publishedRevision=0, publishedUpdatedAt='';
  let pendingRemoteState=null, draftBaselineUnknown=false, previewReturnState=null;
  let pendingDraft=false, documentWriteBlock='', history=[], historyIndex=-1, historyTimer=null;

  let baselineFingerprint,historyFingerprint;

  function flags(){
    return {hasBaseline:Boolean(lastSavedState),pendingDraft,documentWriteBlock,historyIndex,historyLength:history.length};
  }
  function snapshot() {
    return Object.freeze({lastSavedState:clone(lastSavedState),publishedRevision,publishedUpdatedAt,
      pendingRemoteState:clone(pendingRemoteState),draftBaselineUnknown,previewReturnState:clone(previewReturnState),
      ...flags()});
  }
  function establishBaseline(state){lastSavedState=clone(state);baselineFingerprint=undefined;}
  function acceptPublished(row,state){
    establishBaseline(state);publishedRevision=Math.max(0,Number(row?.revision)||0);
    publishedUpdatedAt=String(row?.updated_at||row?.updatedAt||'');
    pendingRemoteState=null;draftBaselineUnknown=false;
  }
  function prepareOverwrite(row,state){acceptPublished(row,state);}
  function adoptImportBaseline(state,revision,updatedAt){
    establishBaseline(state);draftBaselineUnknown=false;publishedRevision=revision;publishedUpdatedAt=updatedAt;
  }
  function restoreDraftBaseline({baseline,revision,updatedAt,unknown,remote}){
    establishBaseline(baseline);publishedRevision=Math.max(0,Number(revision)||0);
    publishedUpdatedAt=String(updatedAt||'');draftBaselineUnknown=unknown;pendingRemoteState=clone(remote);
  }
  function canAdoptRemote(row){return Number(row?.revision)>publishedRevision&&Number(row.revision)>=(Number(pendingRemoteState?.row?.revision)||0);}
  function rememberRemote(row,state){
    if(!canAdoptRemote(row)||Number(row.revision)===Number(pendingRemoteState?.row?.revision))return false;
    pendingRemoteState={row:clone(row),state:clone(state)};return true;
  }
  function markClean(){pendingDraft=false;}
  function acceptOfflineSave(state){establishBaseline(state);pendingDraft=false;}
  function dirty(current,currentFingerprint){
    if(!lastSavedState)return false;
    const workingFingerprint=previewReturnState?fingerprint(previewReturnState):(currentFingerprint??fingerprint(current));
    baselineFingerprint??=fingerprint(lastSavedState);
    return workingFingerprint!==baselineFingerprint;
  }
  function updateDirty(current,currentFingerprint){const wasDirty=pendingDraft;pendingDraft=dirty(current,currentFingerprint);return {wasDirty,pendingDraft};}
  function enterPreview(current){if(!previewReturnState)previewReturnState=clone(current);}
  function leavePreview(){const state=previewReturnState;previewReturnState=null;return clone(state);}
  function blockWrites(message){documentWriteBlock=message;}

  // PREP may adopt only its own changes while unrelated edits keep their old revision.
  function acceptPrepResult({nextBase,saved,result,noOtherDraft,offline,localBaseline}){
    if(noOtherDraft&&!offline){
      establishBaseline(normalize(localBaseline));publishedRevision=Number(result.revision);
      publishedUpdatedAt=result.updated_at;pendingRemoteState=null;draftBaselineUnknown=false;
    }else{
      establishBaseline(nextBase);
      if(offline||(!draftBaselineUnknown&&fingerprint(nextBase)===fingerprint(saved))){
        publishedRevision=Number(result.revision);publishedUpdatedAt=result.updated_at;pendingRemoteState=null;
      }else pendingRemoteState={row:{...result,content:clone(saved)},state:clone(saved)};
    }
  }
  function initializeHistory(current){history=[clone(current)];historyIndex=0;historyFingerprint=undefined;}
  function recordLocalChange(next,nextFingerprint=fingerprint(next)){
    if(historyIndex>=0){
      historyFingerprint??=fingerprint(history[historyIndex]);
      if(historyFingerprint===nextFingerprint)return false;
    }
    historyFingerprint=nextFingerprint;
    history=history.slice(0,historyIndex+1);history.push(clone(next));if(history.length>100)history.shift();
    historyIndex=history.length-1;return true;
  }
  function moveHistory(offset){const next=historyIndex+offset;if(next<0||next>=history.length)return null;historyIndex=next;historyFingerprint=undefined;return clone(history[next]);}
  function reconcileHistory(transform){historyFingerprint=undefined;history=history.map(state=>{try{return transform(clone(state));}catch(_){return state;}});}
  function cancelHistory(){clearTimeout(historyTimer);historyTimer=null;}
  function queueHistory(record){cancelHistory();historyTimer=setTimeout(record,historyDelay());}
  return Object.freeze({snapshot,flags,establishBaseline,acceptPublished,prepareOverwrite,adoptImportBaseline,
    restoreDraftBaseline,canAdoptRemote,rememberRemote,markClean,acceptOfflineSave,dirty,updateDirty,enterPreview,leavePreview,blockWrites,
    acceptPrepResult,initializeHistory,recordLocalChange,moveHistory,reconcileHistory,cancelHistory,queueHistory});
}
