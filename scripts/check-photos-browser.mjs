// Real canvas/DOM checks; Storage is an isolated stub and no remote requests are allowed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('  function blobToDataUrl('), html.indexOf('  function movePhoto('));
const server = createServer((req, res) => res.end('<!doctype html><html><body></body></html>'));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? {channel:process.env.PWA_BROWSER_CHANNEL} : {}) });
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(origin);
  await page.addScriptTag({ content: `
    const TRIP_ID='us-west-2027',MEDIA_BUCKET='trip-media',OFFLINE_MODE=false;
    let operationCancelled=false,operationBusy=false,activeScheduleRow;
    const normalizeState=state=>structuredClone(state),setStatus=()=>{},finishMutation=()=>{},
      updatePhotoMoveButtons=()=>{},decoratePhotoFigure=()=>{},uid=()=>crypto.randomUUID(),
      escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
    const setOperationBusy=value=>{operationBusy=value;};
    const showChoice=async info=>{throw Error(JSON.stringify(info));};
    const uploads=[];
    const client={storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:'https://storage.invalid/'+path}}),
      upload:async(path,blob,options)=>{
        if(!['image/webp','image/jpeg'].includes(blob.type))throw Error('Unsupported MIME: '+blob.type);
        uploads.push({path,blob,options});return {error:null};
      }})}};
    ${source}
    immutableBlobExists=async()=>false;
    window.photoTest={compressImage,blobToDataUrl,materializeStagedPhotos,attachPhotos,uploads,
      setRow:row=>{activeScheduleRow=row;}};
  ` });
  const results = await page.evaluate(async () => {
    const check=(value,message)=>{if(!value)throw Error(message);};
    const api=window.photoTest, nativeToBlob=HTMLCanvasElement.prototype.toBlob;
    const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1000;
    const ctx=canvas.getContext('2d');ctx.fillStyle='red';ctx.fillRect(1000,0,1000,1000);
    const input=await new Promise(resolve=>nativeToBlob.call(canvas,resolve,'image/png'));
    const oldWebp=await new Promise(resolve=>nativeToBlob.call(canvas,resolve,'image/webp'));
    const oldJpeg=await new Promise(resolve=>nativeToBlob.call(canvas,resolve,'image/jpeg'));
    const summary=[];
    for(const fallback of [false,true]){
      const encodes=[];
      HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){
        encodes.push(type);return nativeToBlob.call(this,callback,fallback&&type==='image/webp'?'image/png':type,quality);
      };
      const expected=fallback?'image/jpeg':'image/webp',extension=fallback?'jpg':'webp';
      const row=document.createElement('div');row.innerHTML='<article class="card"><div class="schedule-media-tools"></div></article>';
      document.body.replaceChildren(row);api.setRow(row);api.uploads.length=0;
      await api.attachPhotos([new File([input],'iphone-photo.png',{type:'image/png'})]);
      const figure=row.querySelector('.schedule-photo'),img=figure?.querySelector('img');
      check(figure?.dataset.staged==='true','Photo must remain staged until save');
      check(img.dataset.fullUrl.startsWith('data:'+expected),'Full photo MIME mismatch');
      check(img.src.startsWith('data:'+expected),'Thumbnail MIME mismatch');
      check(api.uploads.length===0,'Attaching must not upload');
      const state={html:row.innerHTML},before=encodes.length;
      const saved=await api.materializeStagedPhotos(state);
      check(encodes.length===before,'Supported staged images must not be re-encoded');
      check(api.uploads.length===2,'Save must upload full and thumbnail');
      check(!saved.html.includes('data-staged'),'Saved photo should no longer be staged');
      check(state.html.includes('data-staged="true"'),'Saving must preserve input draft');
      for(const [index,item] of api.uploads.entries()){
        check(item.path.endsWith('.'+extension),'Storage extension mismatch');
        check(item.options.contentType===expected,'Upload contentType mismatch');
        const bytes=new Uint8Array(await item.blob.arrayBuffer());
        check(fallback?bytes[0]===255&&bytes[1]===216:new TextDecoder().decode(bytes.slice(8,12))==='WEBP','Encoded bytes mismatch');
        const bitmap=await createImageBitmap(item.blob),size=index===0?1600:480;
        check(bitmap.width===size&&bitmap.height===size/2,'Resize mismatch');
        if(fallback){
          const sample=document.createElement('canvas');sample.width=size;sample.height=size/2;
          const sampleCtx=sample.getContext('2d');sampleCtx.drawImage(bitmap,0,0);
          const pixel=sampleCtx.getImageData(10,10,1,1).data;
          check(pixel[0]>245&&pixel[1]>245&&pixel[2]>245&&pixel[3]===255,'Transparent background should be white in JPEG');
        }
        bitmap.close();
      }
      // Old PNG drafts / embedded offline photos must be converted on save too.
      api.uploads.length=0;
      const pngUrl=await api.blobToDataUrl(input);
      await api.materializeStagedPhotos({html:'<figure class="schedule-photo" data-staged="true"><img src="'+pngUrl+'" data-full-url="'+pngUrl+'"></figure>'});
      check(api.uploads.length===2&&api.uploads.every(item=>item.blob.type===expected),'Old PNG draft conversion failed');
      // Saving existing JPEG/WebP on either browser must preserve their bytes and format.
      for(const blob of [oldWebp,oldJpeg]){
        api.uploads.length=0;
        const url=await api.blobToDataUrl(blob);
        const small=await new Promise(resolve=>nativeToBlob.call(canvas,resolve,blob.type,.4));
        const thumbUrl=await api.blobToDataUrl(small),count=encodes.length;
        await api.materializeStagedPhotos({html:'<figure class="schedule-photo"><img src="'+thumbUrl+'" data-full-url="'+url+'"></figure>'});
        check(encodes.length===count,'Existing supported photos were re-encoded');
        check(api.uploads[0].blob.type===blob.type,'Existing format changed');
        check(await api.blobToDataUrl(api.uploads[0].blob)===url,'Existing full photo bytes changed');
      }
      summary.push({mode:fallback?'simulated iPhone WebP fallback':'native WebP',attachSave:'passed',legacyPng:'passed',existingFormats:'passed',dimensionsAndBytes:'passed'});
    }
    HTMLCanvasElement.prototype.toBlob=nativeToBlob;
    return summary;
  });
  assert.equal(results.length, 2);
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
