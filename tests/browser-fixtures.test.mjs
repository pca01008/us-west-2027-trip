import assert from 'node:assert/strict';
import test from 'node:test';
import { injectBrowserFixture, injectArchivedFixture } from '../scripts/browser-fixtures.mjs';

test('fixture seam rejects missing or duplicate composition markers', () => {
  assert.throws(() => injectBrowserFixture(''), /exactly one/);
  assert.throws(() => injectBrowserFixture('// @browser-fixture\n// @browser-fixture'), /exactly one/);
  const transformed = injectBrowserFixture('// @browser-fixture', 'fixture();', {saveMs:120});
  assert.match(transformed, /fixture\(\);/);
  assert.match(transformed, /"saveMs":120/);
  assert.doesNotMatch(transformed, /@browser-fixture/);
  const archived='initializeTimetable();initializeDialogAccessibility();';
  assert.throws(()=>injectBrowserFixture(archived),/exactly one/);
  assert.throws(()=>injectArchivedFixture(archived+archived),/one archived/);
  assert.match(injectArchivedFixture(archived,'fixture();',{versionReadMs:150}),/"versionReadMs":150/);
});
