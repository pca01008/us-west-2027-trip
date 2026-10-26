/** Browser encoding/hash and immutable Storage transport; no draft/render policy. */
function createPhotoService({client,TRIP_ID,MEDIA_BUCKET,SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,operationSignal=()=>null,requestTimeout=value=>value}) {
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

async function withPhotoRequest(task,timeoutMs,label,parentSignal=operationSignal()){
    const controller=new AbortController();
    const abort=()=>controller.abort(parentSignal.reason);
    if(parentSignal?.aborted)abort();else parentSignal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>controller.abort(new Error(label+' 시간이 초과되었습니다. 연결을 확인한 뒤 다시 시도해 주세요.')),requestTimeout(timeoutMs));
    let rejectAbort;
    const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',rejectAbort,{once:true});});
    try{
      controller.signal.throwIfAborted();
      return await Promise.race([task(controller.signal),aborted]);
    }finally{
      clearTimeout(timeout);parentSignal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);
    }
  }

async function immutableBlobExists(path,signal=operationSignal()){
    return withPhotoRequest(async requestSignal=>{
      const response=await fetch(publicMediaUrl(path),{method:'HEAD',cache:'force-cache',signal:requestSignal});
      // Storage can return 400 for a missing object (supabase/storage#323).
      // HEAD has no error body; the insert-only POST will validate permissions.
      if(response.status===400||response.status===404)return false;
      if(!response.ok)throw new Error('사진 확인 실패 · HTTP '+response.status);
      return true;
    },10000,'사진 확인',signal);
  }

async function uploadImmutableBlob(path,blob,signal=operationSignal()){
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
async function fetchAsDataUrl(url){
    if(url.startsWith('data:image/'))return url;
    return withPhotoRequest(async signal=>{
      const absolute=new URL(url,location.href).href,response=await fetch(absolute,{cache:'force-cache',signal});
      if(!response.ok)throw new Error('사진 다운로드 실패 · HTTP '+response.status);
      return blobToDataUrl(await response.blob());
    },60000,'사진 다운로드');
  }
return Object.freeze({blobToDataUrl,dataUrlToBlob,photoExtension,compressImage,hashBlob,publicMediaUrl,isDuplicateUpload,withPhotoRequest,immutableBlobExists,uploadImmutableBlob,uploadPhotoBlobs,fetchAsDataUrl});
}
