import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFactory } from './helpers/factories.mjs';

const clone=structuredClone;
const row=(revision,html='Revision '+revision)=>({revision,updated_at:'time '+revision,content:{html}});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

function fixture(){
  let current={html:'Revision 10'},remote;
  const classes=new Set(),reads=[],cache=[],statuses=[],errors=[],checklist={saving:false};
  const session=loadFactory('documentSession',{clone,normalize:clone,fingerprint:JSON.stringify});
  session.acceptPublished(row(10),current);session.initializeHistory(current);
  const controller=loadFactory('documentWorkflow',{
    OFFLINE_MODE:false,client:{},documentSession:session,body:{classList:{contains:key=>classes.has(key),add:key=>classes.add(key),remove:key=>classes.delete(key)}},
    $:()=>({hidden:true}),clone,normalizeState:clone,migratePublishedState:state=>{if(state.unsupported)throw Error('Unsupported');return clone(state);},fingerprint:JSON.stringify,
    captureState:()=>clone(current),applyState:state=>{current=clone(state);},applyStatePreservingInputs:state=>{current=clone(state);},
    fetchPublishedState:()=>{const read=deferred();reads.push(read);return read.promise;},
    draftStorage:{writePublicCache:(state,metadata)=>{cache.push({state:clone(state),...metadata});return Promise.resolve(true);}},
    initializeHistory:()=>session.initializeHistory(current),setStatus:message=>statuses.push(message),blockUnsupportedDocument:error=>{errors.push(error.message);return true;},
    isChecklistSaving:()=>checklist.saving,pendingCheckCount:()=>0,updateDirtyState:()=>session.updateDirty(current),
    recoverOnlineDraft:async()=>{},finishHydration:()=>{},getEditorSession:async()=>{},setEditingUI:()=>{},resetInactivityTimer:()=>{},
    tripRepository:{subscribe:callback=>{remote=callback;}}
  },{navigator:{onLine:true},console:{warn:()=>{}}});
  return {controller,session,classes,reads,cache,statuses,errors,checklist,current:()=>clone(current),emit:value=>remote({new:value}),
    async hydrate(){const task=controller.hydrate();reads.at(-1).resolve(row(10));await task;cache.length=0;statuses.length=0;}};
}
function assertPublished(f,revision){
  assert.deepEqual(f.current(),row(revision).content);
  assert.equal(f.session.snapshot().publishedRevision,revision);
  assert.deepEqual(f.session.snapshot().lastSavedState,row(revision).content);
  assert.equal(f.cache.at(-1).revision,revision);
  assert.deepEqual(f.cache.at(-1).state,row(revision).content);
}

test('reversed refresh completions retain the newer display, baseline and cache',async()=>{
  const f=fixture(),first=f.controller.refreshPublishedState(),second=f.controller.refreshPublishedState();
  f.reads[1].resolve(row(12));await second;f.reads[0].resolve(row(11));await first;
  assertPublished(f,12);assert.deepEqual(f.cache.map(item=>item.revision),[12]);
});

test('starting another refresh invalidates the earlier response even before the newer read finishes',async()=>{
  const f=fixture(),first=f.controller.refreshPublishedState(),second=f.controller.refreshPublishedState();
  f.reads[0].resolve(row(11));await first;assert.equal(f.current().html,'Revision 10');assert.equal(f.cache.length,0);
  f.reads[1].resolve(row(12));await second;assertPublished(f,12);
});

test('a refresh finishing after newer Realtime cannot regress the document',async()=>{
  const f=fixture();await f.hydrate();const task=f.controller.refreshPublishedState();
  f.emit(row(12));f.reads.at(-1).resolve(row(11));await task;assertPublished(f,12);
});

test('duplicate and older notifications do not reset history, rewrite cache or report changes',async()=>{
  const f=fixture();await f.hydrate();f.emit(row(12));const before=f.session.snapshot(),statusCount=f.statuses.length;
  f.emit(row(12,'Duplicate content must be ignored'));f.emit(row(11));
  const task=f.controller.refreshPublishedState();f.reads.at(-1).resolve(row(12));await task;
  assert.deepEqual(f.session.snapshot(),before);assertPublished(f,12);assert.equal(f.cache.length,1);assert.equal(f.statuses.length,statusCount);
});

test('ordinary refresh never adopts a revision older than the current publication',async()=>{
  const f=fixture(),task=f.controller.refreshPublishedState('reconnect');f.reads[0].resolve(row(9));await task;
  assert.equal(f.current().html,'Revision 10');assert.equal(f.session.snapshot().publishedRevision,10);assert.equal(f.cache.length,0);
});

for(const mode of ['editing','dirty','previewing','checklist'])test('out-of-order remote candidates preserve '+mode+' and keep the newest pending revision',async()=>{
  const f=fixture();await f.hydrate();
  if(mode==='dirty')f.session.updateDirty({html:'Local draft'});
  else if(mode==='previewing')f.controller.enterHistoricalPreview({html:'Historical revision 3'});
  else if(mode==='checklist')f.checklist.saving=true;
  else f.classes.add(mode);
  const before=f.current(),task=f.controller.refreshPublishedState('reconnect');f.emit(row(12));f.emit(row(11));f.emit(row(12));
  f.reads.at(-1).resolve(row(11));await task;
  assert.deepEqual(f.current(),before);assert.equal(f.session.snapshot().publishedRevision,10);assert.equal(f.session.snapshot().lastSavedState.html,'Revision 10');
  assert.equal(f.session.snapshot().pendingRemoteState.row.revision,12);assert.equal(f.session.snapshot().pendingRemoteState.state.html,'Revision 12');assert.equal(f.cache.length,0);
  assert.equal(f.statuses.filter(message=>message.includes('새 공유')).length,1);
  if(mode==='previewing'){f.controller.closePreview();assert.deepEqual(f.current(),row(10).content);}
});

test('superseded errors and unsupported responses cannot replace the latest status or block editing',async()=>{
  const f=fixture(),first=f.controller.refreshPublishedState(),second=f.controller.refreshPublishedState();
  f.reads[1].resolve(row(12));await second;const before=f.statuses.length;f.reads[0].reject(Error('Old request failed'));await first;
  const third=f.controller.refreshPublishedState(),fourth=f.controller.refreshPublishedState();
  f.reads[3].resolve(row(13));await fourth;f.reads[2].resolve({...row(11),content:{html:'Old',unsupported:true}});await third;
  assertPublished(f,13);assert.equal(f.statuses.length,before+1);assert.deepEqual(f.errors,[]);
});

test('a deferred revision can be adopted by refresh after closing historical preview',async()=>{
  const f=fixture();await f.hydrate();f.controller.enterHistoricalPreview({html:'Historical revision 3'});f.emit(row(12));
  f.controller.closePreview();const task=f.controller.refreshPublishedState('reconnect');f.reads.at(-1).resolve(row(12));await task;
  assertPublished(f,12);assert.equal(f.session.snapshot().pendingRemoteState,null);
});
