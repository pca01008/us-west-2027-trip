/** Single owner of publication, preview, dirty and undo transitions. */
function createDocumentSession({clone, normalize, fingerprint}) {
  let lastSavedState=null, publishedRevision=0, publishedUpdatedAt='';
  let pendingRemoteState=null, draftBaselineUnknown=false, previewReturnState=null;
  let pendingDraft=false, documentWriteBlock='', history=[], historyIndex=-1, historyTimer=null;

  function snapshot() {
    return Object.freeze({lastSavedState:clone(lastSavedState),publishedRevision,publishedUpdatedAt,
      pendingRemoteState:clone(pendingRemoteState),draftBaselineUnknown,previewReturnState:clone(previewReturnState),
      pendingDraft,documentWriteBlock,historyIndex,historyLength:history.length});
  }
  function establishBaseline(state){lastSavedState=clone(state);}
  function acceptPublished(row,state){
    lastSavedState=clone(state);publishedRevision=Math.max(0,Number(row?.revision)||0);
    publishedUpdatedAt=String(row?.updated_at||row?.updatedAt||'');
    pendingRemoteState=null;draftBaselineUnknown=false;
  }
  function prepareOverwrite(row,state){acceptPublished(row,state);}
  function adoptImportBaseline(state,revision,updatedAt){
    lastSavedState=clone(state);draftBaselineUnknown=false;publishedRevision=revision;publishedUpdatedAt=updatedAt;
  }
  function restoreDraftBaseline({baseline,revision,updatedAt,unknown,remote}){
    lastSavedState=clone(baseline);publishedRevision=Math.max(0,Number(revision)||0);
    publishedUpdatedAt=String(updatedAt||'');draftBaselineUnknown=unknown;pendingRemoteState=clone(remote);
  }
  function rememberRemote(row,state){pendingRemoteState={row:clone(row),state:clone(state)};}
  function markClean(){pendingDraft=false;}
  function acceptOfflineSave(state){lastSavedState=clone(state);pendingDraft=false;}
  function dirty(current){return Boolean(lastSavedState&&fingerprint(previewReturnState||current)!==fingerprint(lastSavedState));}
  function updateDirty(current){const wasDirty=pendingDraft;pendingDraft=dirty(current);return {wasDirty,pendingDraft};}
  function enterPreview(current){if(!previewReturnState)previewReturnState=clone(current);}
  function leavePreview(){const state=previewReturnState;previewReturnState=null;return clone(state);}
  function blockWrites(message){documentWriteBlock=message;}

  // PREP may adopt only its own changes while unrelated edits keep their old revision.
  function acceptPrepResult({nextBase,saved,result,noOtherDraft,offline,localBaseline}){
    if(noOtherDraft&&!offline){
      lastSavedState=normalize(localBaseline);publishedRevision=Number(result.revision);
      publishedUpdatedAt=result.updated_at;pendingRemoteState=null;draftBaselineUnknown=false;
    }else{
      lastSavedState=clone(nextBase);
      if(offline||(!draftBaselineUnknown&&fingerprint(nextBase)===fingerprint(saved))){
        publishedRevision=Number(result.revision);publishedUpdatedAt=result.updated_at;pendingRemoteState=null;
      }else pendingRemoteState={row:{...result,content:clone(saved)},state:clone(saved)};
    }
  }
  function initializeHistory(current){history=[clone(current)];historyIndex=0;}
  function recordLocalChange(next){
    if(historyIndex>=0&&fingerprint(history[historyIndex])===fingerprint(next))return false;
    history=history.slice(0,historyIndex+1);history.push(clone(next));if(history.length>100)history.shift();
    historyIndex=history.length-1;return true;
  }
  function moveHistory(offset){const next=historyIndex+offset;if(next<0||next>=history.length)return null;historyIndex=next;return clone(history[next]);}
  function reconcileHistory(transform){history=history.map(state=>{try{return transform(clone(state));}catch(_){return state;}});}
  function cancelHistory(){clearTimeout(historyTimer);historyTimer=null;}
  function queueHistory(record){cancelHistory();historyTimer=setTimeout(record,400);}
  return Object.freeze({snapshot,establishBaseline,acceptPublished,prepareOverwrite,adoptImportBaseline,
    restoreDraftBaseline,rememberRemote,markClean,acceptOfflineSave,dirty,updateDirty,enterPreview,leavePreview,blockWrites,
    acceptPrepResult,initializeHistory,recordLocalChange,moveHistory,reconcileHistory,cancelHistory,queueHistory});
}
