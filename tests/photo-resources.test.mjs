import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import test from 'node:test';
import {loadFactory} from './helpers/factories.mjs';

const api=loadFactory('photoResources',{SUPABASE_URL:'https://storage.test',MEDIA_BUCKET:'trip-media',baseUrl:'https://example.test/trip/'},{URL,atob});
const data=bytes=>'data:image/webp;base64,'+Buffer.from(bytes).toString('base64');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const img=(src,full=src)=>{
  const attributes=new Map([['src',src],['data-full-url',full]]);
  return {getAttribute:key=>attributes.get(key)||null,setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)};
};

test('embedded identities match SHA-256 bytes across padding boundaries and large photos',()=>{
  for(const length of [0,1,3,55,56,63,64,65,119,120,128,1024,1024*1024]){
    const bytes=randomBytes(length);
    assert.equal(api.resource(data(bytes)),'sha256:'+digest(bytes));
  }
});

test('immutable paths, public URLs and embedded bytes share identity',()=>{
  const bytes=Buffer.from('same photo'),hash=digest(bytes),path='browser-fixture/photos/'+hash+'.webp';
  const expected=api.resource(data(bytes));
  assert.equal(api.resource(path),expected);
  assert.equal(api.resource('https://storage.test/storage/v1/object/public/trip-media/'+path+'?download=1#photo'),expected);
  assert.notEqual(api.resource('https://other.test/storage/v1/object/public/trip-media/'+path),expected);
  assert.notEqual(api.resource('https://storage.test/storage/v1/object/public/other-bucket/'+path),expected);
  assert.notEqual(api.resource(data('new image')),expected);
  assert.equal(api.resource('data:IMAGE/WEBP;base64, c2FtZSBwaG90bw==\n'),expected);
});

test('asset and legacy storage exports keep verified source links; replaced bytes invalidate them',()=>{
  for(const source of ['assets/photo.png','https://example.test/trip/assets/photo.png','https://storage.test/storage/v1/object/public/trip-media/browser-fixture/legacy.jpg']){
    const image=img(source),embedded=data('original');
    for(const slot of ['full','thumb'])api.embedResource(image,slot,source,embedded);
    image.setAttribute('src',embedded);image.setAttribute('data-full-url',embedded);
    assert.equal(api.imageResource(image,'full'),api.resource(source));
    assert.equal(api.imageResource(image,'thumb'),api.resource(source));
    api.embedResource(image,'full',embedded,embedded);
    assert.equal(api.imageResource(image,'full'),api.resource(source),'Repeated exports retain the original source');
    image.setAttribute('data-full-url',data('replacement'));
    assert.equal(api.imageResource(image,'full'),api.resource(data('replacement')));
    assert.equal(api.imageResource(image,'thumb'),api.resource(source));
  }
});

test('invalid data and absent resources do not crash comparison or alias immutable content',()=>{
  assert.equal(api.resource(''),'');
  assert.equal(api.imageResource(null,'full'),'');
  assert.doesNotThrow(()=>api.resource('data:image/png;base64,???'));
  const image=img(data('new'));
  image.setAttribute('data-full-source','sha256:'+digest(Buffer.from('old')));
  image.setAttribute('data-full-digest',api.resource(data('new')));
  assert.equal(api.imageResource(image,'full'),api.resource(data('new')));
});

test('stored paths compare equal to matching image URLs and expose path-only replacements',()=>{
  const oldHash=digest(Buffer.from('old')),newHash=digest(Buffer.from('new'));
  const oldPath='browser-fixture/photos/'+oldHash+'.webp',newPath='browser-fixture/photos/'+newHash+'.webp';
  const image=img('https://storage.test/storage/v1/object/public/trip-media/'+oldPath);
  assert.equal(api.imageResource(image,'full',oldPath),api.imageResource(image,'full'));
  assert.notEqual(api.imageResource(image,'full',newPath),api.imageResource(image,'full',oldPath));
  assert.equal(api.imageResource(null,'full',oldPath),'sha256:'+oldHash);
});
