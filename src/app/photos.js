function createPhotosController({isValidHttpsUrl,$,OFFLINE_MODE,blobToDataUrl,body,compressImage,dataUrlToBlob,decorateMapLink,decoratePhotoFigure,escapeHtml,finishMutation,isOperationBusy,isOperationCancelled,mapPlaceName,normalizeState,recordHistory,setFieldError,setOperationBusy,setStatus,showChoice,showDialog,uid,updatePhotoMoveButtons,uploadPhotoBlobs}) {
let activeScheduleRow = null;
let activePhotoFigure = null;











  async function materializeStagedPhotos(state){
    const normalized=normalizeState(state);if(OFFLINE_MODE)return normalized;
    const template=document.createElement('template');template.innerHTML=normalized.html;
    const figures=Array.from(template.content.querySelectorAll('.schedule-photo')).filter(figure=>{const img=figure.querySelector('img');return figure.dataset.staged==='true'||img?.src?.startsWith('data:image/')||img?.dataset.fullUrl?.startsWith('data:image/');});
    for(let index=0;index<figures.length;index++){
      if(isOperationCancelled())throw new Error('사진 업로드가 취소되었습니다.');
      const figure=figures[index],img=figure.querySelector('img'),fullData=img.dataset.fullUrl||img.src;if(!fullData?.startsWith('data:image/'))continue;
      setStatus('사진 업로드 '+(index+1)+'/'+figures.length);
      const source=dataUrlToBlob(fullData),full=['image/webp','image/jpeg'].includes(source.type)?source:await compressImage(source,1600,.8);
      const hasDistinctThumb=img.src?.startsWith('data:image/')&&img.src!==fullData,thumbSource=hasDistinctThumb?dataUrlToBlob(img.src):null,thumb=['image/webp','image/jpeg'].includes(thumbSource?.type)?thumbSource:await compressImage(full,480,.76);
      const uploaded=await uploadPhotoBlobs(full,thumb);
      figure.dataset.fullPath=uploaded.fullPath;figure.dataset.thumbPath=uploaded.thumbPath;delete figure.dataset.staged;
      img.src=uploaded.thumbUrl;img.dataset.fullUrl=uploaded.fullUrl;
    }
    normalized.html=template.innerHTML;return normalized;
  }
  function photoLabelFromName(name){return String(name||'일정 사진').replace(/\.[^.]+$/,'').trim()||'일정 사진';}
  function createPhotoFigure(info,label='일정 사진'){const figure=document.createElement('figure');figure.className='schedule-photo';figure.dataset.photoId=uid('photo');if(info.fullPath)figure.dataset.fullPath=info.fullPath;if(info.thumbPath)figure.dataset.thumbPath=info.thumbPath;if(info.staged)figure.dataset.staged='true';const safeLabel=photoLabelFromName(label);figure.innerHTML='<img alt="'+escapeHtml(safeLabel)+'" decoding="async" fetchpriority="low" loading="lazy" src="'+escapeHtml(info.thumbUrl||info.fullUrl)+'" data-full-url="'+escapeHtml(info.fullUrl||'')+'"><figcaption>'+escapeHtml(safeLabel)+'</figcaption>';decoratePhotoFigure(figure);return figure;}
  async function attachPhotos(files){
    if(!activeScheduleRow||!files.length||isOperationBusy())return;
    const card=activeScheduleRow.querySelector('.card');let gallery=card.querySelector('.schedule-gallery');
    if(!gallery){gallery=document.createElement('div');gallery.className='schedule-gallery';card.insertBefore(gallery,card.querySelector('.schedule-media-tools'));}
    let attached=0;const failures=[];setOperationBusy(true,{cancelable:true,status:'사진 준비 0/'+files.length});
    try{
      for(let index=0;index<files.length;index++){
        if(isOperationCancelled())break;const file=files[index];setStatus('사진 준비 '+(index+1)+'/'+files.length+' · '+file.name);
        try{if(file.size>20*1024*1024)throw new Error('20MB를 초과했습니다.');const full=await compressImage(file,1600,.8);if(isOperationCancelled())break;const thumb=await compressImage(file,480,.76),info={fullUrl:await blobToDataUrl(full),thumbUrl:await blobToDataUrl(thumb),staged:true};gallery.appendChild(createPhotoFigure(info,file.name));attached++;}
        catch(error){console.error(error);failures.push(file.name+' · '+error.message);}
      }
      updatePhotoMoveButtons(gallery);if(attached)finishMutation();
    }finally{const cancelled=isOperationCancelled();setOperationBusy(false);setStatus(cancelled?'사진 작업 취소 · '+attached+'개 초안 유지':'사진 '+attached+'개 저장 대기');}
    if(failures.length)await showChoice({title:'일부 사진을 준비하지 못했습니다.',message:failures.slice(0,5).join('\n')+(failures.length>5?'\n외 '+(failures.length-5)+'개':''),choices:[{label:'확인',value:'ok',className:'action-primary'}]});
  }
  function movePhoto(figure,direction){if(!body.classList.contains('editing')||!figure)return;const gallery=figure.parentElement,figures=Array.from(gallery.querySelectorAll(':scope > .schedule-photo')),index=figures.indexOf(figure),next=index+direction;if(index<0||next<0||next>=figures.length)return;if(direction<0)figures[next].before(figure);else figures[next].after(figure);updatePhotoMoveButtons(gallery);recordHistory();}
  function openPhotoEditDialog(figure){activePhotoFigure=figure;const img=figure?.querySelector('img'),caption=figure?.querySelector('figcaption');if(!img)return;$('#photoCaption').value=caption?.textContent.trim()||'';$('#photoAlt').value=img.alt||'';setFieldError('photoCaption');setFieldError('photoAlt');showDialog($('#photoEditDialog'));$('#photoCaption').focus();$('#photoCaption').select();}
  function savePhotoMetadata(){const figure=activePhotoFigure,img=figure?.querySelector('img');if(!figure||!img)return;const caption=$('#photoCaption').value.trim(),alt=$('#photoAlt').value.trim();setFieldError('photoCaption',caption?'':'사진 설명을 입력해 주세요.');setFieldError('photoAlt',alt?'':'대체 텍스트를 입력해 주세요.');if(!caption||!alt){$(caption?'#photoAlt':'#photoCaption').focus();return;}let text=figure.querySelector('figcaption');if(!text){text=document.createElement('figcaption');figure.appendChild(text);}text.textContent=caption;img.alt=alt;img.setAttribute('aria-label',caption+' 크게 보기');$('#photoEditDialog').hidden=true;activePhotoFigure=null;recordHistory();}
  function openMapDialog(row){activeScheduleRow=row;const map=row.querySelector('.schedule-map a');$('#mapName').value=mapPlaceName(map);$('#mapUrl').value=map?.href||'';setFieldError('mapName');setFieldError('mapUrl');showDialog($('#mapDialog'));$('#mapName').focus();}
  function saveMap(){const name=$('#mapName').value.trim(),url=$('#mapUrl').value.trim();setFieldError('mapName',name?'':'장소명을 입력해 주세요.');setFieldError('mapUrl',isValidHttpsUrl(url)?'':'https 지도 링크를 입력해 주세요.');if(!name||!isValidHttpsUrl(url)){$(name?'#mapUrl':'#mapName').focus();return;}const card=activeScheduleRow?.querySelector('.card');if(!card)return;let map=card.querySelector('.schedule-map');if(!map){map=document.createElement('div');map.className='schedule-map';card.insertBefore(map,card.querySelector('.schedule-media-tools'));}map.innerHTML='<a href="'+escapeHtml(url)+'" rel="noopener noreferrer" target="_blank" data-place-name="'+escapeHtml(name)+'"></a><button class="schedule-map-delete" type="button">삭제</button>';decorateMapLink(map);$('#mapDialog').hidden=true;recordHistory();}

function selectActiveScheduleRow(row){activeScheduleRow=row;}
function resetPhotoSelection(){activeScheduleRow=null;activePhotoFigure=null;}

function bindPhotosControls(){
['mapName','mapUrl','photoCaption','photoAlt'].forEach(id=>$('#'+id).addEventListener('input',()=>setFieldError(id)));
$('#mapCancel').onclick=()=>$('#mapDialog').hidden=true;
$('#mapSave').onclick=saveMap;
$('#photoEditCancel').onclick=()=>{$('#photoEditDialog').hidden=true;activePhotoFigure=null;};
$('#photoEditSave').onclick=savePhotoMetadata;
$('#photoViewerClose').onclick=()=>$('#photoViewer').hidden=true;
$('#photoInput').onchange=e=>{void attachPhotos(Array.from(e.target.files||[]));e.target.value='';};
document.addEventListener('click',event=>{if(isOperationBusy())return;
const photoMove=event.target.closest('[data-move-photo]');if(photoMove&&!photoMove.disabled){movePhoto(photoMove.closest('.schedule-photo'),Number(photoMove.dataset.movePhoto));return;}
const photoEdit=event.target.closest('[data-edit-photo]');if(photoEdit&&body.classList.contains('editing')){openPhotoEditDialog(photoEdit.closest('.schedule-photo'));return;}
const photo=event.target.closest('.schedule-photo img');if(photo&&!photo.closest('.map-capture')&&!body.classList.contains('editing')){$('#photoViewerImage').src=photo.dataset.fullUrl||photo.src;$('#photoViewerImage').alt=photo.alt||'일정 사진';showDialog($('#photoViewer'));return;}
if(event.target.closest('[data-delete-photo]')&&body.classList.contains('editing')){const figure=event.target.closest('.schedule-photo'),gallery=figure?.parentElement;figure?.remove();if(gallery&&!gallery.querySelector('.schedule-photo'))gallery.remove();else updatePhotoMoveButtons(gallery);recordHistory();return;}
if(event.target.classList.contains('schedule-map-delete')&&body.classList.contains('editing')){event.target.closest('.schedule-map')?.remove();recordHistory();return;}
});
document.addEventListener('keydown',event=>{const photo=event.target.closest?.('.schedule-photo img[role="button"]');if(photo&&!body.classList.contains('editing')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();photo.click();}});
}

return Object.freeze({materializeStagedPhotos,photoLabelFromName,createPhotoFigure,attachPhotos,movePhoto,openPhotoEditDialog,savePhotoMetadata,openMapDialog,saveMap,selectActiveScheduleRow,resetPhotoSelection,bindPhotosControls});
}
