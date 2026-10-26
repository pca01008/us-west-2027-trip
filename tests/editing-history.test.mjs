import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFactory } from './helpers/factories.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));

function fixture() {
  let now=0,sequence=0,current={html:'Original'},cleanups=0;
  const timers=new Map(),controls=new Map(),drafts=[];
  const globals={
    setTimeout(callback,delay){const id=++sequence;timers.set(id,{at:now+delay,callback});return id;},
    clearTimeout(id){timers.delete(id);}
  };
  const session=loadFactory('documentSession',{clone,normalize:clone,fingerprint:JSON.stringify},globals);
  session.establishBaseline(current);
  const editor=loadFactory('editing',{
    $:selector=>{if(!controls.has(selector))controls.set(selector,{});return controls.get(selector);},
    body:{classList:{contains:name=>name==='editing'}},
    captureState:()=>clone(current),applyState:state=>{current=clone(state);},
    documentAdapter:{isApplying:()=>false},documentSession:session,
    queueDraftPersistence:()=>drafts.push(clone(current)),flushDraftPersistence:async()=>{},
    clearCleanDraft:()=>{cleanups++;},syncChecklistControls:()=>{},
    setStatus:()=>{},resetInactivityTimer:()=>{}
  });
  editor.initializeHistory();
  function tick(ms) {
    now+=ms;
    for(const [id,timer] of timers)if(timer.at<=now){timers.delete(id);timer.callback();}
  }
  return {editor,session,tick,controls,drafts,
    input(text){current={html:text};editor.queueHistory();},
    text:()=>current.html,cleanups:()=>cleanups,timers:()=>timers.size};
}

for(const delay of [0,1,199,399,400])test(`Undo/Redo retains the latest input at ${delay}ms`,()=>{
  const f=fixture();
  f.input('Recorded edit');f.tick(400);
  assert.equal(f.controls.get('#undoBtn').disabled,false);
  f.input('Fast second edit');f.tick(delay);
  f.editor.moveHistory(-1);
  assert.equal(f.text(),'Recorded edit');
  assert.equal(f.session.dirty({html:f.text()}),true);
  assert.equal(f.timers(),0,'Undo cancels the pending history callback');
  f.tick(1000);
  assert.equal(f.text(),'Recorded edit','The old timer must not change the undone state');
  f.editor.moveHistory(1);
  assert.equal(f.text(),'Fast second edit');
  assert.equal(f.drafts.at(-1).html,'Fast second edit');
  assert.equal(f.session.snapshot().historyLength,3,'No duplicate snapshot on Redo');
});

test('continuous input remains one pending edit and can undo to a clean baseline',()=>{
  const f=fixture();
  f.input('A');f.tick(100);f.input('AB');f.tick(100);f.input('ABC');f.tick(399);
  f.editor.moveHistory(-1);
  assert.equal(f.text(),'Original');
  assert.equal(f.session.dirty({html:f.text()}),false);
  assert.equal(f.cleanups(),1);
  f.tick(1000);
  assert.equal(f.session.snapshot().historyLength,2);
  f.editor.moveHistory(1);
  assert.equal(f.text(),'ABC');
  assert.equal(f.drafts.at(-1).html,'ABC');
  f.editor.moveHistory(-1);f.editor.moveHistory(1);
  assert.equal(f.text(),'ABC');
  assert.equal(f.session.snapshot().historyLength,2);
});

test('new input after Undo replaces the redo branch without losing the new text',()=>{
  const f=fixture();
  f.input('First');f.tick(400);f.input('Second');f.tick(400);
  f.editor.moveHistory(-1);assert.equal(f.text(),'First');
  f.input('Replacement');
  f.editor.moveHistory(1);
  assert.equal(f.text(),'Replacement','Redo cannot restore the abandoned branch');
  assert.equal(f.controls.get('#redoBtn').disabled,true);
  f.editor.moveHistory(-1);assert.equal(f.text(),'First');
  f.editor.moveHistory(1);assert.equal(f.text(),'Replacement');
  assert.equal(f.session.snapshot().historyLength,3);
});
