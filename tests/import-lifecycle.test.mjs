import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFactory } from './helpers/factories.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(){
  const controls=new Map(),reads=[],applied=[],choices=[],statuses=[],errors=[];
  let session={user:{email:'fixture@example.test'}},signingOut=false,materialize=()=>{};
  const baseline={html:'Published'},published={content:baseline,revision:7,updated_at:'baseline time'};
  const $=selector=>{if(!controls.has(selector))controls.set(selector,{hidden:true,disabled:false,value:''});return controls.get(selector);};
  const controller=loadFactory('imports',{
    $,SCHEMA_VERSION:6,TRIP_ID:'fixture',clone,documentSession:{snapshot:()=>({lastSavedState:baseline})},
    sessionService:{current:()=>session,isSigningOut:()=>signingOut},
    fetchPublishedState:()=>{const item=reads.shift();calls++;item?.start();return item?item.promise:Promise.resolve(published);},
    normalizeState:clone,migratePublishedState:clone,
    buildDiff:(a,b)=>a.html===b.html?[]:[{title:'Schedule',items:[b.html]}],
    renderDiff:(_summary,_diff,groups)=>groups.length,
    applyImportSnapshot:(...args)=>applied.push(clone(args)),publicMediaUrl:path=>'https://fixture.test/'+path,
    requireEditor:async(_purpose,action)=>action(),setStatus:message=>statuses.push(message),
    showChoice:async choice=>choices.push(choice),showDialog:dialog=>{dialog.hidden=false;}
  },{
    console:{error:error=>errors.push(error.message)},
    DOMParser:class{parseFromString(source){return {documentElement:{dataset:{tripId:'fixture',offline:'true',schemaVersion:'6'}},querySelector:()=>({textContent:source})};}},
    document:{createElement:()=>({innerHTML:'',content:{querySelectorAll(){materialize();return [];}}})}
  });
  let calls=0;
  controller.bindImportsControls();
  return {controller,$,applied,choices,statuses,errors,published,
    file:html=>({text:async()=>JSON.stringify({html})}),
    readGate(){const gate=deferred(),started=deferred();gate.start=started.resolve;gate.started=started.promise;reads.push(gate);return gate;},
    calls:()=>calls,cancel:()=>$('#importCancel').onclick(),
    setSession:value=>{session=value;},signOut:()=>{signingOut=true;},onMaterialize:fn=>{materialize=fn;}};
}

for(const failure of [false,true])test(`Cancel ignores a late Apply ${failure?'failure':'result'}`,async()=>{
  const f=fixture();await f.controller.readImportFile(f.file('Incoming'));
  const gate=f.readGate(),apply=f.controller.applyImportedDraft();
  assert.equal(f.$('#importApply').disabled,true);
  f.cancel();
  failure?gate.reject(new Error('Late read failure')):gate.resolve(f.published);
  await apply;
  assert.equal(f.controller.pendingImportSnapshot(),null);
  assert.equal(f.$('#importDialog').hidden,true);
  assert.deepEqual([f.applied,f.choices,f.errors,f.statuses],[[],[],[],[]]);
});

test('Cancel at the materialization await leaves the existing draft untouched',async()=>{
  const f=fixture();await f.controller.readImportFile(f.file('Incoming'));
  f.onMaterialize(()=>queueMicrotask(f.cancel));
  await f.controller.applyImportedDraft();
  assert.deepEqual([f.applied,f.choices,f.errors],[[],[],[]]);
  assert.equal(f.controller.pendingImportSnapshot(),null);
  assert.deepEqual(f.statuses,['편집본 사진을 준비 중입니다.']);
});

test('a materialization failure after cancellation is silent',async()=>{
  const f=fixture();await f.controller.readImportFile(f.file('Incoming'));
  f.onMaterialize(()=>{f.cancel();throw new Error('Canceled materialization');});
  await f.controller.applyImportedDraft();
  assert.deepEqual([f.applied,f.choices,f.errors],[[],[],[]]);
});

test('replacing the selection invalidates an Apply without changing the new controls',async()=>{
  const f=fixture();await f.controller.readImportFile(f.file('Old'));
  const gate=f.readGate(),apply=f.controller.applyImportedDraft();
  await f.controller.readImportFile(f.file('New'));
  gate.resolve(f.published);await apply;
  assert.equal(f.controller.pendingImportSnapshot().state.html,'New');
  assert.equal(f.$('#importApply').disabled,false);
  assert.deepEqual([f.applied,f.choices,f.errors,f.statuses],[[],[],[],[]]);
  await f.controller.applyImportedDraft();
  assert.equal(f.applied.length,1);assert.equal(f.applied[0][0].html,'New');
});

for(const failure of [false,true])test(`reversed file text ${failure?'errors':'results'} cannot replace the latest selection`,async()=>{
  const f=fixture(),text=deferred();
  const old=f.controller.readImportFile({text:()=>text.promise});
  await f.controller.readImportFile(f.file('New'));
  f.$('#importFileInput').value='new file input';
  failure?text.reject(new Error('Old file failed')):text.resolve(JSON.stringify({html:'Old'}));
  await old;
  assert.equal(f.controller.pendingImportSnapshot().state.html,'New');
  assert.equal(f.$('#importFileInput').value,'new file input','A stale finally cannot clear a newer input');
  assert.equal(f.calls(),1,'Stale file text must not start a remote comparison');
  assert.deepEqual([f.choices,f.errors],[[],[]]);
});

for(const failure of [false,true])test(`reversed comparison reads ignore old ${failure?'errors':'results'}`,async()=>{
  const f=fixture(),gate=f.readGate();
  const old=f.controller.readImportFile(f.file('Old'));
  await gate.started;
  await f.controller.readImportFile(f.file('New'));
  failure?gate.reject(new Error('Old comparison failed')):gate.resolve({...f.published,revision:6});
  await old;
  assert.equal(f.controller.pendingImportSnapshot().state.html,'New');
  assert.equal(f.controller.pendingImportSnapshot().baselineRevision,7);
  assert.deepEqual([f.applied,f.choices,f.errors],[[],[],[]]);
});

for(const stage of ['file','comparison','apply','materialization'])test(`sign-out invalidates the ${stage} boundary`,async()=>{
  const f=fixture();let work,gate;
  if(stage==='file'){
    gate=deferred();work=f.controller.readImportFile({text:()=>gate.promise});
  }else if(stage==='comparison'){
    gate=f.readGate();work=f.controller.readImportFile(f.file('Incoming'));await gate.started;
  }else{
    await f.controller.readImportFile(f.file('Incoming'));
    if(stage==='materialization')f.onMaterialize(()=>queueMicrotask(()=>{f.setSession(null);f.controller.resetImportSelection();}));
    else gate=f.readGate();
    work=f.controller.applyImportedDraft();
  }
  if(gate){f.signOut();f.controller.resetImportSelection();gate.resolve(stage==='file'?JSON.stringify({html:'Incoming'}):f.published);}
  await work;
  assert.equal(f.controller.pendingImportSnapshot(),null);
  assert.equal(f.$('#importDialog').hidden,true);
  assert.deepEqual([f.applied,f.choices,f.errors],[[],[],[]]);
});

test('session validity is rechecked even before the sign-out cleanup runs',async()=>{
  const f=fixture();await f.controller.readImportFile(f.file('Incoming'));
  const gate=f.readGate(),apply=f.controller.applyImportedDraft();
  f.signOut();gate.resolve(f.published);await apply;
  assert.deepEqual([f.applied,f.choices,f.errors,f.statuses],[[],[],[],[]]);
});

test('duplicate Apply starts one read and applies the captured selection once',async()=>{
  const f=fixture();await f.controller.readImportFile(f.file('Incoming'));
  const gate=f.readGate(),apply=f.controller.applyImportedDraft();
  await f.controller.applyImportedDraft();
  assert.equal(f.calls(),2);assert.equal(f.$('#importApply').disabled,true);
  gate.resolve(f.published);await apply;
  assert.deepEqual(f.applied,[[{html:'Incoming',schemaVersion:6},{html:'Published'},7,'baseline time']]);
  assert.equal(f.controller.pendingImportSnapshot(),null);
});

for(const changed of [true,false])test(`revision change requires reconfirmation (${changed?'differences':'identical'})`,async()=>{
  const f=fixture();await f.controller.readImportFile(f.file('Incoming'));
  f.published.revision=8;f.published.content={html:changed?'New baseline':'Incoming'};
  await f.controller.applyImportedDraft();
  assert.equal(f.applied.length,0);assert.equal(f.$('#importApply').disabled,!changed);
  assert.equal(f.controller.pendingImportSnapshot().baselineRevision,8);
  await f.controller.applyImportedDraft();assert.equal(f.applied.length,changed?1:0);
});

test('an active read error stays actionable and permits a retry',async()=>{
  const f=fixture();await f.controller.readImportFile(f.file('Incoming'));
  const gate=f.readGate(),apply=f.controller.applyImportedDraft();gate.reject(new Error('Connection failed'));await apply;
  assert.equal(f.choices.length,1);assert.equal(f.choices[0].message,'Connection failed');
  assert.equal(f.$('#importApply').disabled,false);
  await f.controller.applyImportedDraft();assert.equal(f.applied.length,1);
});
