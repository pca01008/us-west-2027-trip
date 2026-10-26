function createImportsController({$,SCHEMA_VERSION,TRIP_ID,applyImportSnapshot,buildDiff,clone,documentSession,fetchPublishedState,migratePublishedState,normalizeState,publicMediaUrl,renderDiff,requireEditor,setStatus,showChoice,showDialog}) {
let pendingImport = null;
function renderImportDiff(groups,message=''){const count=renderDiff($('#importSummary'),$('#importDiff'),groups,message||(groups.length?'불러오면 현재 화면의 초안으로 적용됩니다.':'최신 저장본과 동일합니다.'));$('#importApply').disabled=!count;}

async function chooseImportFile(){await requireEditor('import',()=>$('#importFileInput').click());}

async function readImportFile(file){
    try{
      const source=await file.text(),doc=new DOMParser().parseFromString(source,'text/html');
      if(doc.documentElement.dataset.tripId!==TRIP_ID||doc.documentElement.dataset.offline!=='true')throw new Error('이 여행에서 만든 오프라인 작업본이 아닙니다.');
      const validateVersion=value=>{const version=Number(value);if(!Number.isInteger(version)||version<1)throw new Error('파일 버전을 확인할 수 없습니다.');if(version>SCHEMA_VERSION)throw new Error('더 새로운 버전에서 만든 파일입니다. 온라인 페이지를 먼저 업데이트해 주세요.');return version;};
      const fileVersion=validateVersion(doc.documentElement.dataset.schemaVersion);
      const embedded=doc.querySelector('#offlineEmbeddedState');if(!embedded)throw new Error('편집 데이터가 없습니다.');
      const raw=JSON.parse(embedded.textContent);
      if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.html!=='string'||!raw.html.trim())throw new Error('편집 데이터가 없습니다.');
      const schemaVersion=raw.schemaVersion===undefined?fileVersion:validateVersion(raw.schemaVersion);
      const incoming=normalizeState(migratePublishedState({...raw,schemaVersion}),true),published=await fetchPublishedState();
      const current=normalizeState(published?.content?.html?migratePublishedState(published.content):documentSession.snapshot().lastSavedState),groups=buildDiff(current,incoming);
      pendingImport={state:incoming,baselineRevision:Math.max(0,Number(published?.revision)||0),baselineUpdatedAt:published?.updated_at||'',current};renderImportDiff(groups);showDialog($('#importDialog'));
    }catch(error){console.error(error);await showChoice({title:'작업본을 불러올 수 없습니다.',message:error.message,choices:[{label:'확인',value:'ok',className:'action-primary'}]});}
    finally{$('#importFileInput').value='';}
  }

async function materializeImportedPhotos(state){const normalized=normalizeState(state,true),template=document.createElement('template');template.innerHTML=normalized.html;for(const figure of template.content.querySelectorAll('.schedule-photo')){const img=figure.querySelector('img'),fullPath=figure.dataset.fullPath,thumbPath=figure.dataset.thumbPath;if(fullPath&&thumbPath){img.src=publicMediaUrl(thumbPath);img.dataset.fullUrl=publicMediaUrl(fullPath);continue;}if(!img.src.startsWith('data:image/'))continue;img.dataset.fullUrl=img.dataset.fullUrl||img.src;figure.dataset.staged='true';delete figure.dataset.fullPath;delete figure.dataset.thumbPath;}normalized.html=template.innerHTML;return normalized;}

async function applyImportedDraft(){if(!pendingImport)return;try{const published=await fetchPublishedState(),remoteRevision=Math.max(0,Number(published?.revision)||0);if(remoteRevision!==pendingImport.baselineRevision){if(!published?.content?.html)throw new Error('최신 저장본을 다시 확인하지 못했습니다.');const current=normalizeState(migratePublishedState(published.content)),groups=buildDiff(current,pendingImport.state);pendingImport.current=current;pendingImport.baselineRevision=remoteRevision;pendingImport.baselineUpdatedAt=published.updated_at||'';renderImportDiff(groups,'비교 중 최신 저장본이 변경되어 차이를 다시 계산했습니다. 내용을 확인하고 한 번 더 불러오세요.');return;}setStatus('편집본 사진을 준비 중입니다.');const incoming=await materializeImportedPhotos(pendingImport.state);applyImportSnapshot(incoming,pendingImport.current,pendingImport.baselineRevision,pendingImport.baselineUpdatedAt);$('#importDialog').hidden=true;pendingImport=null;setStatus('편집본 불러옴 · 저장되지 않음');}catch(error){console.error(error);setStatus('편집본 적용 실패');await showChoice({title:'편집본 적용 실패',message:error.message,choices:[{label:'확인',value:'ok',className:'action-primary'}]});}}

function resetImportSelection(){pendingImport=null;}

function bindImportsControls(){
$('#importBtn').onclick=chooseImportFile;
$('#importFileInput').onchange=e=>{if(e.target.files[0])readImportFile(e.target.files[0]);};
$('#importCancel').onclick=()=>{$('#importDialog').hidden=true;pendingImport=null;};
$('#importApply').onclick=applyImportedDraft;
}
function pendingImportSnapshot(){return clone(pendingImport);}

return Object.freeze({renderImportDiff,chooseImportFile,readImportFile,materializeImportedPhotos,applyImportedDraft,resetImportSelection,bindImportsControls,pendingImportSnapshot});
}
