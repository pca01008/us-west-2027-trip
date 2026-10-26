  function uid(prefix='id') {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function hashText(value) { let hash=2166136261; for (const c of String(value)) { hash^=c.charCodeAt(0); hash=Math.imul(hash,16777619); } return (hash>>>0).toString(36); }
  let documentWriteBlock='';
  function assertSupportedSchema(raw){
    const version=raw?.schemaVersion??0;
    if(!Number.isInteger(Number(version))||Number(version)<0||Number(version)>SCHEMA_VERSION){const error=new Error('앱을 새로고침해 주세요');error.code='DOCUMENT_SCHEMA';throw error;}
  }
  function blockUnsupportedDocument(error){
    if(!['DOCUMENT_SCHEMA','DOCUMENT_LEDGER','DOCUMENT_CURRENCY'].includes(error?.code))return false;
    documentWriteBlock=error.code==='DOCUMENT_CURRENCY'?error.message:error.code==='DOCUMENT_SCHEMA'?'앱을 새로고침해 주세요':'지출 데이터를 읽지 못했습니다. 작업본을 보관하고 최근 저장 버전을 확인해 주세요.';
    clearTimeout(draftWriteTimer);setStatus(documentWriteBlock);return true;
  }
  function setStatus(message) { if ($('#status')) $('#status').textContent = documentWriteBlock||message; }
  function finishHydration() {
    if (!body.classList.contains('hydrating')) return;
    body.classList.remove('hydrating');
    const loading=$('#appLoading'),main=$('main');
    if(loading){loading.hidden=true;loading.setAttribute('aria-hidden','true');}
    if(main)main.removeAttribute('aria-busy');
    if(pendingDraft)queueDraftPersistence();
  }
