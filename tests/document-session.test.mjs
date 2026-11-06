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

test('cached comparisons follow new baselines and transformed history',()=>{
  const api=create(),previous={html:'Original staged photo'},next={html:'Updated staged photo'};
  api.acceptPublished({revision:1},previous);
  assert.equal(api.dirty(next),true);
  api.acceptPrepResult({nextBase:next,saved:next,result:{revision:2},noOtherDraft:false,offline:false});
  assert.equal(api.dirty(next),false);
  assert.equal(api.dirty(previous),true);
  api.restoreDraftBaseline({baseline:previous,revision:1,unknown:false,remote:null});
  assert.equal(api.dirty(previous),false);

  api.initializeHistory(previous);
  assert.equal(api.recordLocalChange(previous),false);
  api.reconcileHistory(()=>next);
  assert.equal(api.recordLocalChange(next),false);
  assert.equal(api.recordLocalChange(previous),true);
  assert.equal(api.moveHistory(-1).html,next.html);
  assert.equal(api.recordLocalChange(next),false);
});
