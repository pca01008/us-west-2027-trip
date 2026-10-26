import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFactory } from './helpers/factories.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const create=()=>loadFactory('documentSession',{clone,normalize:clone,fingerprint:JSON.stringify});

test('PREP retains the old revision when unrelated local and remote changes diverge', () => {
  const api=create();
  api.restoreDraftBaseline({baseline:{title:'old',checked:false},revision:1,updatedAt:'old',unknown:true,remote:null});
  api.acceptPrepResult({nextBase:{title:'old',checked:true},saved:{title:'remote',checked:true},
    result:{revision:3,updated_at:'new'},noOtherDraft:false,offline:false});
  const state=api.snapshot();
  assert.equal(state.publishedRevision,1);
  assert.equal(state.draftBaselineUnknown,true);
  assert.equal(state.lastSavedState.checked,true);
  assert.equal(state.pendingRemoteState.state.title,'remote');
  assert.equal(api.dirty({title:'private',checked:true}),true);
  state.lastSavedState.title='accidental external mutation';
  assert.equal(api.snapshot().lastSavedState.title,'old');
});

test('switching previews preserves the working copy and never changes the published baseline', () => {
  const api=create();
  api.acceptPublished({revision:4},{title:'published'});
  api.enterPreview({title:'working draft'});
  api.enterPreview({title:'historical preview'});
  assert.equal(api.dirty({title:'published'}),true);
  assert.deepEqual(clone(api.leavePreview()),{title:'working draft'});
  assert.equal(api.snapshot().publishedRevision,4);
  assert.equal(api.snapshot().lastSavedState.title,'published');
  assert.equal(api.dirty({title:'published'}),false);
});
