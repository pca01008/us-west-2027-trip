function writePublicCache(state,metadata={}){
  const baseline=documentSession.snapshot();
  return draftStorage.writePublicCache(state,{...metadata,revision:metadata.revision??baseline.publishedRevision,updatedAt:metadata.updatedAt??baseline.publishedUpdatedAt});
}

function showDraftStorageWarning(kind='') {
    let warning=$('#draftStorageWarning');
    if(!warning){warning=document.createElement('span');warning.id='draftStorageWarning';warning.className='chip';warning.setAttribute('role','alert');$('#status').after(warning);}
    warning.hidden=!kind;
    warning.textContent=kind==='delete'?'초안 삭제 실패 · 저장 공간을 확인한 뒤 다시 시도해 주세요.':kind==='read'?'브라우저 초안을 확인하지 못했습니다 · 저장 공간을 확인해 주세요.':kind?'초안 보관 실패 · 새로고침 전에 공유 저장하거나 내보내세요.':'';
  }

function setPublishedBaseline(row,state,cacheMetadata={}) {
    const normalized=normalizeState(state),current=normalizeState(captureState());
    documentSession.acceptPublished(row,fingerprint(current)===fingerprint(normalized)?normalized:current);
    void writePublicCache(documentSession.snapshot().lastSavedState,cacheMetadata);
  }
