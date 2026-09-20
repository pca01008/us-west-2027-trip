import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('  function photoExtension('), html.indexOf('  async function materializeStagedPhotos('));

function app({ webp = true, jpeg = true, nullResult = false, exists = false, error = null } = {}) {
  const encodes = [], fills = [], uploads = [], sizes = [];
  let closed = 0;
  const context2d = { drawImage() {}, fillRect(...args) { fills.push({ color: this.fillStyle, operation: this.globalCompositeOperation, args }); } };
  const context = vm.createContext({ Blob, crypto: webcrypto, TRIP_ID: 'us-west-2027', MEDIA_BUCKET: 'trip-media',
    createImageBitmap: async () => ({ width: 2400, height: 1200, close() { closed++; } }),
    document: { createElement() { return { getContext: () => context2d, toBlob(callback, type, quality) {
      encodes.push({ type, quality }); sizes.push([this.width, this.height]);
      const actual = type === 'image/webp' && !webp || type === 'image/jpeg' && !jpeg ? 'image/png' : type;
      callback(nullResult ? null : new Blob(['encoded ' + actual], { type: actual }));
    } }; } },
    fetch: async () => ({ ok: exists }),
    client: { storage: { from() { return {
      getPublicUrl: path => ({ data: { publicUrl: 'https://example.test/' + path } }),
      upload: async (path, blob, options) => { uploads.push({ path, blob, options }); return { error }; }
    }; } } }
  });
  vm.runInContext(source, context);
  return { context, encodes, fills, uploads, sizes, get closed() { return closed; } };
}

test('WebP 출력이 지원되면 크기와 품질을 적용하고 WebP를 유지한다', async () => {
  const a = app(), blob = await a.context.compressImage(new Blob(['input']), 1600, .8);
  assert.equal(blob.type, 'image/webp');
  assert.deepEqual(a.encodes, [{ type: 'image/webp', quality: .8 }]);
  assert.deepEqual(a.sizes, [[1600, 800]]);
  assert.equal(a.closed, 1);
  assert.equal(a.fills.length, 0);
});

test('WebP 요청이 PNG를 반환하면 흰 배경 JPEG로 다시 인코딩한다', async () => {
  const a = app({ webp: false }), blob = await a.context.compressImage(new Blob(['input']), 480, .76);
  assert.equal(blob.type, 'image/jpeg');
  assert.deepEqual(a.encodes.map(e => e.type), ['image/webp', 'image/jpeg']);
  assert.deepEqual(a.sizes, [[480, 240], [480, 240]]);
  assert.equal(a.fills[0].color, '#fff');
  assert.equal(a.fills[0].operation, 'destination-over');
  assert.equal(a.closed, 1);
});

test('JPEG 변환까지 실패하거나 빈 결과가 나오면 잘못된 파일을 업로드하지 않는다', async () => {
  for (const options of [{ webp: false, jpeg: false }, { nullResult: true }]) {
    const a = app(options);
    await assert.rejects(a.context.compressImage(new Blob(['input']), 1600), /변환하지 못|압축 실패/);
    assert.equal(a.uploads.length, 0);
  }
});

test('실제 Blob 형식으로 원본과 썸네일의 확장자 및 MIME을 각각 결정한다', async () => {
  const a = app(), full = new Blob(['full'], { type: 'image/jpeg' }), thumb = new Blob(['thumb'], { type: 'image/webp' });
  const result = await a.context.uploadPhotoBlobs(full, thumb);
  assert.match(result.fullPath, /^us-west-2027\/photos\/[a-f0-9]{64}\.jpg$/);
  assert.match(result.thumbPath, /^us-west-2027\/thumbs\/[a-f0-9]{64}\.webp$/);
  assert.equal(a.uploads.length, 2);
  for (const item of a.uploads) {
    assert.equal(item.options.contentType, item.blob.type);
    assert.equal(item.options.upsert, false);
  }
});

test('PNG 또는 5MB 초과 사진은 두 파일 모두 업로드 전에 차단한다', async () => {
  const full = new Blob(['full'], { type: 'image/jpeg' });
  for (const bad of [new Blob(['png'], { type: 'image/png' }), new Blob([], { type: 'image/jpeg' }), new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' })]) {
    const a = app();
    await assert.rejects(a.context.uploadPhotoBlobs(full, bad), /변환하지 못|5MB/);
    assert.equal(a.uploads.length, 0);
  }
});

test('이미 저장된 사진은 재업로드하지 않고 서버 오류는 전달한다', async () => {
  const blob = new Blob(['full'], { type: 'image/jpeg' }), cached = app({ exists: true });
  await cached.context.uploadPhotoBlobs(blob, blob);
  assert.equal(cached.uploads.length, 0);
  const failing = app({ error: { message: 'mime type image/jpeg is not supported' } });
  await assert.rejects(failing.context.uploadPhotoBlobs(blob, blob), e => e.message.includes('not supported'));
});

test('신규 서버와 기존 서버 마이그레이션은 같은 제한된 업로드 경로를 허용한다', async () => {
  const files = ['supabase_setup.sql', 'migrations/20260920_photo_jpeg_fallback.sql'];
  const policies = [];
  for (const file of files) {
    const sql = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(sql, /array\['image\/webp','image\/jpeg'\]/);
    const policy = sql.match(/create policy "editor can upload trip media"[\s\S]*?\n\);/)[0];
    policies.push(policy);
    assert.match(policy, /to authenticated/);
    assert.match(policy, /public\.is_trip_editor\(split_part\(name, '\/', 1\)\)/);
    const pattern = new RegExp(policy.match(/and name ~ '([^']+)'/)[1]);
    for (const extension of ['webp', 'jpg']) assert.ok(pattern.test('us-west-2027/photos/' + 'a'.repeat(64) + '.' + extension));
    for (const name of ['us-west-2027/photos/' + 'a'.repeat(64) + '.png', '../photos/' + 'a'.repeat(64) + '.jpg', 'us-west-2027/photos/unhashed.jpg']) assert.ok(!pattern.test(name));
  }
  assert.equal(policies[0], policies[1]);
});
