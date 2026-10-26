import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFactory } from './helpers/factories.mjs';

const clone=structuredClone;

function fixture(fail=false) {
  let current={html:'Existing draft'},historyResets=0,dirtyUpdates=0;
  const session=loadFactory('documentSession',{clone,normalize:clone,fingerprint:JSON.stringify});
  session.acceptPublished({revision:7,updated_at:'original time'},{html:'Original baseline'});
  session.initializeHistory({html:'Original baseline'});
  session.recordLocalChange(current);session.updateDirty(current);
  session.rememberRemote({revision:8},{html:'Pending remote'});
  const controller=loadFactory('documentWorkflow',{
    documentSession:session,
    applyState(state){
      assert.equal(session.snapshot().publishedRevision,7,'Rendering must finish before baseline adoption');
      if(fail)throw new Error('Render failed');
      current=clone(state);
    },
    initializeHistory(){historyResets++;session.initializeHistory(current);},
    updateDirtyState(){dirtyUpdates++;session.updateDirty(current);}
  });
  return {controller,session,current:()=>current,counts:()=>[historyResets,dirtyUpdates]};
}

test('failed import application retains baseline, revision, pending remote, dirty state and undo history',()=>{
  const f=fixture(true),before=f.session.snapshot();
  assert.throws(()=>f.controller.applyImportSnapshot({html:'Incoming'},{html:'New baseline'},9,'new time'),/Render failed/);
  assert.deepEqual(f.session.snapshot(),before);
  assert.deepEqual(f.current(),{html:'Existing draft'});
  assert.deepEqual(f.counts(),[0,0]);
  assert.deepEqual(f.session.moveHistory(-1),{html:'Original baseline'});
  assert.deepEqual(f.session.moveHistory(1),{html:'Existing draft'});
});

test('successful import adopts the compared baseline and starts a dirty draft history after rendering',()=>{
  const f=fixture(),incoming={html:'Incoming'},baseline={html:'New baseline'};
  f.controller.applyImportSnapshot(incoming,baseline,9,'new time');
  const result=f.session.snapshot();
  assert.deepEqual(f.current(),incoming);
  assert.deepEqual(result.lastSavedState,baseline);
  assert.equal(result.publishedRevision,9);
  assert.equal(result.publishedUpdatedAt,'new time');
  assert.equal(result.pendingDraft,true);
  assert.equal(result.historyIndex,0);
  assert.equal(result.historyLength,1);
  assert.deepEqual(f.counts(),[1,1]);
});
