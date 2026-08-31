import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('핵심 배포 파일이 존재한다', async () => {
  const files = ['index.html', 'trip-config.js', 'supabase_setup.sql', 'register_trip.sql'];
  const contents = await Promise.all(files.map(file => readFile(path.join(root, file), 'utf8')));
  contents.forEach((content, index) => assert.ok(content.length > 0, `${files[index]}가 비어 있습니다.`));
});

test('테스트 미리보기는 실제 index.html을 참조한다', async () => {
  for (const file of ['test.html', 'test2.html']) {
    const html = await readFile(path.join(root, file), 'utf8');
    assert.match(html, /src="index\.html\?previewDate=/);
  }
});

test('스키마 마이그레이션은 저장된 일정 섹션을 기본값으로 교체하지 않는다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const migration = html.match(/function migratePublishedState\(raw\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.ok(migration, 'migratePublishedState 함수를 찾을 수 없습니다.');
  assert.doesNotMatch(migration, /replaceWith|BASELINE_MAIN_HTML|PUBLISHED_MIGRATION_SELECTORS/);
  assert.match(migration, /legacy-row/);
  assert.match(migration, /legacy-check/);
});

test('Supabase 저장은 비공개 편집자 매핑과 낙관적 잠금을 사용한다', async () => {
  const [setup, register] = await Promise.all([
    readFile(path.join(root, 'supabase_setup.sql'), 'utf8'),
    readFile(path.join(root, 'register_trip.sql'), 'utf8')
  ]);
  assert.match(setup, /create table if not exists public\.trip_editors/);
  assert.match(setup, /p_expected_revision bigint/);
  assert.match(setup, /Revision conflict/);
  assert.match(setup, /serialized_size > 4194304/);
  assert.match(setup, /set search_path = public, pg_temp/);
  const editorColumnDrop = setup.indexOf('drop column if exists editor_id');
  const versionPolicyCleanup = setup.indexOf("execute 'drop policy if exists \"only the editor can read trip versions\"");
  const storagePolicyCleanup = setup.indexOf("execute 'drop policy if exists \"editor can upload trip media\"");
  assert.ok(versionPolicyCleanup >= 0 && versionPolicyCleanup < editorColumnDrop, '버전 정책 의존성을 editor_id보다 먼저 제거해야 합니다.');
  assert.ok(storagePolicyCleanup >= 0 && storagePolicyCleanup < editorColumnDrop, 'Storage 정책 의존성을 editor_id보다 먼저 제거해야 합니다.');
  assert.match(setup, /revoke all on public\.trip_document_versions from authenticated;\s*grant select \(id, trip_id, content, note, content_size, created_at\)/);
  assert.match(register, /on conflict \(trip_id\) do nothing/);
  assert.doesNotMatch(register, /do update\s+set editor_id/i);
  assert.match(register, /Ownership was not changed/);
});

test('브라우저 초안은 IndexedDB에 보존되고 저장 시 revision을 확인한다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /indexedDB\.open\(DRAFT_DB_NAME/);
  assert.match(html, /recoverOnlineDraft/);
  assert.match(html, /beginEditing\(\)\{if\(!OFFLINE_MODE&&!pendingDraft\)/);
  assert.match(html, /p_expected_revision:publishedRevision/);
  assert.match(html, /pendingRemoteState=\{row:payload\.new,state:remoteState\}/);
  assert.match(html, /PUBLIC_CACHE_RECORD_KEY/);
  assert.match(html, /transaction\.objectStore\('records'\)\.put\(record,PUBLIC_CACHE_RECORD_KEY\)/);
  assert.match(html, /writePublicCache\(legacy\.state,legacy\)/);
  assert.match(html, /metadata\.revision\?\?publishedRevision/);
  assert.doesNotMatch(html, /localStorage\.setItem\((?:OFFLINE_)?CACHE_KEY/);
  assert.match(html, /window\.addEventListener\('pagehide'/);
  assert.match(html, /draftWriteGeneration\+\+/);
  assert.match(html, /generation!==draftWriteGeneration/);
  assert.match(html, /request\.onsuccess=\(\)=>resolve\(!request\.result\)/);
  const recovery = html.match(/async function recoverOnlineDraft\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(recovery, /pendingDraft=false/);
  assert.match(recovery, /lastSavedState=clone\(normalizeState\(captureState\(\)\)\)/);
  assert.match(recovery, /const cleared=await clearDraftRecord\(\)/);
});

test('초기 기본 일정은 최신 공유본 확인이 끝날 때까지 노출하지 않는다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<body class="viewing hydrating">/);
  assert.match(html, /id="appLoading" role="status" aria-live="polite"/);
  assert.match(html, /\.hydrating>\.tabs,[^\n]+\.hydrating>main\{display:none\}/);
  assert.match(html, /function finishHydration\(\)/);
  assert.match(html, /await recoverOnlineDraft\(\);finishHydration\(\)/);
  assert.match(html, /hydrate\(\)\.catch\([\s\S]*?\.finally\(finishHydration\)/);
  assert.match(html, /className='viewing offline-mode hydrating'/);
  assert.match(html, /cloneLoading\.hidden=false/);
  assert.match(html, /\.preview-banner,\.app-loading,\.tab-scroll/);
});

test('현재 여행과 재사용 템플릿은 보존형 스키마 5를 사용한다', async () => {
  for (const file of ['trip-config.js', 'trip-config.template.js']) {
    const source = await readFile(path.join(root, file), 'utf8');
    assert.match(source, /schemaVersion:\s*5/);
  }
});

test('편집 세션은 탭 간에 동기화되고 재연결 시 최신본을 확인한다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /new BroadcastChannel\(SESSION_CHANNEL_NAME\)/);
  assert.match(html, /requestManualLogout/);
  assert.match(html, /handleExternalSignOut/);
  assert.match(html, /window\.addEventListener\('online'.*refreshPublishedState/);
  assert.match(html, /window\.addEventListener\('beforeunload'/);
  assert.match(html, /zonedDateKey\(now,VISITOR_TIME_ZONE\)/);
  assert.match(html, /id="logoutBtn"/);
  const warning = html.match(/async function showInactivityWarning\(\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(warning, /clearSessionTimers\(\);if\(choice==='save'\)/);
  assert.match(warning, /else resetInactivityTimer\(\)/);
  assert.match(html, /finally\{setEditorSession\(null\);signingOut=false;\}/);
  assert.match(html, /if\(submit\.disabled\)return;submit\.disabled=true/);
});

test('사진은 초안에 스테이징되고 최종 저장에서만 업로드된다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const attach = html.match(/async function attachPhotos\(files\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.ok(attach);
  assert.match(attach, /staged:true/);
  assert.doesNotMatch(attach, /uploadPhotoBlobs/);
  assert.match(html, /materializeStagedPhotos\(normalized\)/);
  assert.match(html, /data-move-photo/);
  assert.match(html, /data-move-row/);
  assert.match(html, /id="photoEditDialog"/);
});

test('공유용 HTML은 사진 포함과 독립 탭 런타임을 제공한다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /appendReadonlyRuntime/);
  assert.match(html, /id='readonlyRuntime'/);
  assert.match(html, /panel\.hidden=!active/);
  assert.match(html, /label\.setAttribute\('aria-selected'/);
  assert.match(html, /event\.key==='ArrowRight'/);
  assert.match(html, /embedPhotos\(captureState\(\),\{strict:false\}\)/);
  assert.match(html, /const thumbData=!thumb\|\|thumb===full\?fullData:await fetchAsDataUrl\(thumb\)/);
  assert.match(html, /setOperationBusy\(true,\{cancelable:true,status:'오프라인 작업본 준비 중'\}\)/);
  assert.match(html, /setOperationBusy\(true,\{cancelable:true,status:'인쇄·공유용 사본 준비 중'\}\)/);
  assert.match(html, /cloneDoc\.querySelectorAll\('main input,main select'\)/);
});

test('오프라인 불러오기는 revision을 재확인하고 최종 기준점을 갱신한다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const applyImport = html.match(/async function applyImportedDraft\(\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(html, /baselineRevision:Math\.max\(0,Number\(published\?\.revision\)\|\|0\)/);
  assert.match(applyImport, /remoteRevision!==pendingImport\.baselineRevision/);
  assert.match(applyImport, /publishedRevision=pendingImport\.baselineRevision/);
  assert.doesNotMatch(applyImport, /lastSavedState=clone\(current\)/);
  assert.match(html, /IMPORT_ALLOWED_MONEY_IDS/);
  assert.match(html, /seenCheckIds\.has\(label\.dataset\.checkId\)/);
  assert.match(html, /seenRowIds\.has\(row\.dataset\.rowId\)/);
  assert.match(html, /seenPhotoIds\?\.has\(figure\.dataset\.photoId\)/);
  assert.match(html, /amount:Number\.isFinite\(amount\)\?amount:0/);
  assert.match(html, /a\.rel='noopener noreferrer'/);
});

test('버전 목록은 메타데이터만 받고 본문은 선택 시 지연 로딩한다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const versions = html.match(/async function openVersions\(\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.ok(versions);
  assert.match(versions, /select\('id,note,content_size,created_at'\)/);
  assert.doesNotMatch(versions, /select\('id,content/);
  assert.match(html, /async function loadVersionContent/);
  assert.match(html, /id="versionCompareDialog"/);
  assert.match(html, /p_version_note:note/);
  assert.match(html, /현재 저장하지 않은 초안은 복원본으로 대체/);
  const restore = html.match(/async function restoreSelectedVersion\(\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.doesNotMatch(restore, /applyState\(restored\)/);
});

test('가계부는 예산·필터·안전한 CSV와 필수 카테고리 보호를 제공한다', async () => {
  const [html, config] = await Promise.all([
    readFile(path.join(root, 'index.html'), 'utf8'),
    readFile(path.join(root, 'trip-config.js'), 'utf8')
  ]);
  assert.match(html, /id="budgetOverview"/);
  assert.match(html, /id="expenseFilterCategory"/);
  assert.match(html, /id="expenseFilterQuery"/);
  assert.match(html, /haystack\.includes\(query\)/);
  assert.match(html, /function exportExpensesCsv/);
  assert.match(html, /if\(\/\^\[=\+\\-@\]\//);
  assert.match(html, /budgetKrw:Number\.isFinite/);
  assert.match(html, /REQUIRED_CATEGORY_IDS|id==='misc'/);
  assert.match(html, /const deletedIndex=categories\.findIndex\(item=>item\.id===DELETED_CATEGORY_ID\)/);
  assert.match(config, /defaultBudgetKrw:\s*0/);
  assert.match(config, /id:\s*'misc'.*system:\s*true/);
});

test('탭·모달은 키보드 접근성을 제공하고 CSS는 단일 cascade로 정리된다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /setAttribute\('role','tablist'\)/);
  assert.match(html, /ArrowRight/);
  assert.match(html, /initializeDialogAccessibility/);
  assert.match(html, /focusableIn\(dialog\)/);
  assert.match(html, /event\.key==='Escape'/);
  assert.match(html, /function insertPlainText\(target,text\)/);
  assert.match(html, /range\.insertNode\(node\)/);
  assert.match(html, /insertPlainText\(target,text\)/);
  assert.equal((html.match(/<style(?:\s[^>]*)?>/g) || []).length, 1);
  assert.equal((html.match(/@layer\s+(?:base|itinerary|timeline|session|modern|features|ledger)\s*\{/g) || []).length, 7);
  assert.ok((html.match(/!important/g) || []).length <= 6, 'important 선언이 다시 과도하게 늘었습니다.');
});

test('주요 코랄 버튼은 흰색 텍스트 대비 4.5:1 이상이다', () => {
  const luminance = hex => {
    const channels = hex.match(/[a-f\d]{2}/gi).map(value => Number.parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrast = (first, second) => (Math.max(luminance(first), luminance(second)) + 0.05) / (Math.min(luminance(first), luminance(second)) + 0.05);
  assert.ok(contrast('a93f35', 'ffffff') >= 4.5);
});

test('외부 SDK는 고정 버전과 SRI를 사용하고 설정 뒤에 로드된다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const configIndex = html.indexOf('id="tripConfigScript"');
  const sdkIndex = html.indexOf('@supabase/supabase-js@2.112.4');
  const appIndex = html.indexOf('id="tripAppV4"');
  assert.ok(configIndex >= 0 && configIndex < sdkIndex && sdkIndex < appIndex);
  assert.match(html, /@supabase\/supabase-js@2\.112\.4[^>]+integrity="sha384-[^"]+"[^>]+crossorigin="anonymous"/);
});

test('기본 일정은 자유 HTML 대신 구조화된 링크와 비용 데이터를 사용한다', async () => {
  const [html, config] = await Promise.all([
    readFile(path.join(root, 'index.html'), 'utf8'),
    readFile(path.join(root, 'trip-config.js'), 'utf8')
  ]);
  assert.doesNotMatch(config, /extraHtml\s*:/);
  assert.match(html, /Object\.hasOwn\(event,'extraHtml'\)/);
  assert.match(html, /renderConfigReference/);
  assert.match(html, /renderConfigTourCosts/);
});

test('문서와 GitHub 검증 설정은 스키마 5 운영 방식과 일치한다', async () => {
  const [readme, guide, summary, workflow, ignore] = await Promise.all([
    readFile(path.join(root, 'README.md'), 'utf8'),
    readFile(path.join(root, 'PROJECT_GUIDE_KO.md'), 'utf8'),
    readFile(path.join(root, 'PROJECT_GUIDE_SUMMARY_KO.md'), 'utf8'),
    readFile(path.join(root, '.github/workflows/validate.yml'), 'utf8'),
    readFile(path.join(root, '.gitignore'), 'utf8')
  ]);
  assert.match(guide, /schemaVersion 5/);
  assert.match(summary, /schemaVersion 5/);
  assert.doesNotMatch(guide, /trip_documents\.editor_id/);
  assert.doesNotMatch(summary, /trip_documents\.editor_id/);
  assert.match(readme, /npm test/);
  assert.match(workflow, /run: npm test/);
  assert.match(ignore, /\/reference\.html/);
});
