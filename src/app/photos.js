  function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});}
  function dataUrlToBlob(dataUrl){const [head,data]=dataUrl.split(','),mime=(head.match(/data:([^;]+)/)||[])[1]||'image/webp',bytes=atob(data),array=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);return new Blob([array],{type:mime});}
  function photoExtension(blob){
    const extension={'image/webp':'webp','image/jpeg':'jpg'}[blob?.type];
    if(!extension)throw new Error('사진 형식을 변환하지 못했습니다. 다른 사진을 선택해 주세요.');
    if(!blob.size||blob.size>5*1024*1024)throw new Error('사진은 압축 후 5MB 이하여야 합니다. 크기를 줄여 다시 추가해 주세요.');
    return extension;
  }
  async function compressImage(file,maxSide,quality=.8){
    const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');
    const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');
    try{context.drawImage(bitmap,0,0,canvas.width,canvas.height);}finally{bitmap.close();}
    const encode=type=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('이미지 압축 실패')),type,quality));
    let blob=await encode('image/webp');
    if(blob.type!=='image/webp'){
      // Safari can return PNG for a WebP request. Flatten transparency before JPEG encoding.
      context.globalCompositeOperation='destination-over';context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
      blob=await encode('image/jpeg');
      if(blob.type!=='image/jpeg')throw new Error('사진 형식을 변환하지 못했습니다. 다른 사진을 선택해 주세요.');
    }
    photoExtension(blob);return blob;
  }
  async function hashBlob(blob){const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}
  function publicMediaUrl(path){return client.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;}
  function isDuplicateUpload(error){return /already exists|duplicate/i.test(String(error?.message||error?.error||''));}
  async function withPhotoRequest(task,timeoutMs,label,parentSignal=operationController?.signal){
    const controller=new AbortController();
    const abort=()=>controller.abort(parentSignal.reason);
    if(parentSignal?.aborted)abort();else parentSignal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>controller.abort(new Error(label+' 시간이 초과되었습니다. 연결을 확인한 뒤 다시 시도해 주세요.')),timeoutMs);
    let rejectAbort;
    const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',rejectAbort,{once:true});});
    try{
      controller.signal.throwIfAborted();
      return await Promise.race([task(controller.signal),aborted]);
    }finally{
      clearTimeout(timeout);parentSignal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);
    }
  }
  async function immutableBlobExists(path,signal=operationController?.signal){
    return withPhotoRequest(async requestSignal=>{
      const response=await fetch(publicMediaUrl(path),{method:'HEAD',cache:'force-cache',signal:requestSignal});
      // Storage can return 400 for a missing object (supabase/storage#323).
      // HEAD has no error body; the insert-only POST will validate permissions.
      if(response.status===400||response.status===404)return false;
      if(!response.ok)throw new Error('사진 확인 실패 · HTTP '+response.status);
      return true;
    },10000,'사진 확인',signal);
  }
  async function uploadImmutableBlob(path,blob,signal=operationController?.signal){
    photoExtension(blob);if(await immutableBlobExists(path,signal))return;
    // This SDK version's Storage upload ignores AbortSignal. Use the same
    // authenticated, insert-only endpoint directly so cancellation reaches fetch.
    return withPhotoRequest(async requestSignal=>{
      const {data,error}=await client.auth.getSession();requestSignal.throwIfAborted();
      if(error)throw error;
      if(!data.session?.access_token)throw new Error('다시 로그인한 뒤 사진을 저장해 주세요.');
      const response=await fetch(SUPABASE_URL+'/storage/v1/object/'+MEDIA_BUCKET+'/'+path,{
        method:'POST',signal:requestSignal,
        headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+data.session.access_token,'Content-Type':blob.type,'Cache-Control':'max-age=31536000','x-upsert':'false'},body:blob
      });
      const result=await response.json();requestSignal.throwIfAborted();
      if(!response.ok&&!isDuplicateUpload(result))throw new Error(result.message||result.error||'사진 업로드 실패 · HTTP '+response.status);
    },60000,'사진 업로드',signal);
  }
  async function uploadPhotoBlobs(full,thumb){const fullExtension=photoExtension(full),thumbExtension=photoExtension(thumb),[fullHash,thumbHash]=await Promise.all([hashBlob(full),hashBlob(thumb)]),fullPath=TRIP_ID+'/photos/'+fullHash+'.'+fullExtension,thumbPath=TRIP_ID+'/thumbs/'+thumbHash+'.'+thumbExtension;await Promise.all([uploadImmutableBlob(fullPath,full),uploadImmutableBlob(thumbPath,thumb)]);return {fullPath,thumbPath,fullUrl:publicMediaUrl(fullPath),thumbUrl:publicMediaUrl(thumbPath)};}
  async function materializeStagedPhotos(state){
    const normalized=normalizeState(state);if(OFFLINE_MODE)return normalized;
    const template=document.createElement('template');template.innerHTML=normalized.html;
    const figures=Array.from(template.content.querySelectorAll('.schedule-photo')).filter(figure=>{const img=figure.querySelector('img');return figure.dataset.staged==='true'||img?.src?.startsWith('data:image/')||img?.dataset.fullUrl?.startsWith('data:image/');});
    for(let index=0;index<figures.length;index++){
      if(operationCancelled)throw new Error('사진 업로드가 취소되었습니다.');
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
    if(!activeScheduleRow||!files.length||operationBusy)return;
    const card=activeScheduleRow.querySelector('.card');let gallery=card.querySelector('.schedule-gallery');
    if(!gallery){gallery=document.createElement('div');gallery.className='schedule-gallery';card.insertBefore(gallery,card.querySelector('.schedule-media-tools'));}
    let attached=0;const failures=[];setOperationBusy(true,{cancelable:true,status:'사진 준비 0/'+files.length});
    try{
      for(let index=0;index<files.length;index++){
        if(operationCancelled)break;const file=files[index];setStatus('사진 준비 '+(index+1)+'/'+files.length+' · '+file.name);
        try{if(file.size>20*1024*1024)throw new Error('20MB를 초과했습니다.');const full=await compressImage(file,1600,.8);if(operationCancelled)break;const thumb=await compressImage(file,480,.76),info={fullUrl:await blobToDataUrl(full),thumbUrl:await blobToDataUrl(thumb),staged:true};gallery.appendChild(createPhotoFigure(info,file.name));attached++;}
        catch(error){console.error(error);failures.push(file.name+' · '+error.message);}
      }
      updatePhotoMoveButtons(gallery);if(attached)finishMutation();
    }finally{const cancelled=operationCancelled;setOperationBusy(false);setStatus(cancelled?'사진 작업 취소 · '+attached+'개 초안 유지':'사진 '+attached+'개 저장 대기');}
    if(failures.length)await showChoice({title:'일부 사진을 준비하지 못했습니다.',message:failures.slice(0,5).join('\n')+(failures.length>5?'\n외 '+(failures.length-5)+'개':''),choices:[{label:'확인',value:'ok',className:'action-primary'}]});
  }
  function movePhoto(figure,direction){if(!body.classList.contains('editing')||!figure)return;const gallery=figure.parentElement,figures=Array.from(gallery.querySelectorAll(':scope > .schedule-photo')),index=figures.indexOf(figure),next=index+direction;if(index<0||next<0||next>=figures.length)return;if(direction<0)figures[next].before(figure);else figures[next].after(figure);updatePhotoMoveButtons(gallery);recordHistory();}
  function openPhotoEditDialog(figure){activePhotoFigure=figure;const img=figure?.querySelector('img'),caption=figure?.querySelector('figcaption');if(!img)return;$('#photoCaption').value=caption?.textContent.trim()||'';$('#photoAlt').value=img.alt||'';$('#photoEditDialog').hidden=false;$('#photoCaption').focus();$('#photoCaption').select();}
  function savePhotoMetadata(){const figure=activePhotoFigure,img=figure?.querySelector('img');if(!figure||!img)return;const caption=$('#photoCaption').value.trim(),alt=$('#photoAlt').value.trim();if(!caption||!alt){setStatus('사진 설명과 대체 텍스트를 모두 입력해 주세요.');return;}let text=figure.querySelector('figcaption');if(!text){text=document.createElement('figcaption');figure.appendChild(text);}text.textContent=caption;img.alt=alt;img.setAttribute('aria-label',caption+' 크게 보기');$('#photoEditDialog').hidden=true;activePhotoFigure=null;recordHistory();}
  function openMapDialog(row){activeScheduleRow=row;const map=row.querySelector('.schedule-map a');$('#mapName').value=mapPlaceName(map);$('#mapUrl').value=map?.href||'';$('#mapDialog').hidden=false;$('#mapName').focus();}
  function saveMap(){const name=$('#mapName').value.trim(),url=$('#mapUrl').value.trim();if(!name||!/^https:\/\//i.test(url)){setStatus('장소명과 https 지도 링크를 입력해 주세요.');return;}const card=activeScheduleRow?.querySelector('.card');if(!card)return;let map=card.querySelector('.schedule-map');if(!map){map=document.createElement('div');map.className='schedule-map';card.insertBefore(map,card.querySelector('.schedule-media-tools'));}map.innerHTML='<a href="'+escapeHtml(url)+'" rel="noopener noreferrer" target="_blank" data-place-name="'+escapeHtml(name)+'"></a><button class="schedule-map-delete" type="button">삭제</button>';decorateMapLink(map);$('#mapDialog').hidden=true;recordHistory();}
