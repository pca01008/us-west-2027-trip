import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFactory } from './helpers/factories.mjs';

test('repository preserves SDK save results, conflict identity and abort signal', async () => {
  const signal = new AbortController().signal;
  const conflict = {code:'40001',status:409,message:'Revision conflict'};
  const response = {error:conflict,status:409};
  let call;
  const api = loadFactory('repository', {tripId:'fixture',client:{
    rpc(name, args) { call={name,args}; return {abortSignal(value) {assert.equal(value,signal);return response;}}; }
  }});
  assert.equal(await api.saveDocument({html:'draft'},7,'note',signal),response);
  assert.equal(call.name,'save_trip_document');
  assert.deepEqual(JSON.parse(JSON.stringify(call.args)),{
    p_trip_id:'fixture',p_content:{html:'draft'},p_expected_revision:7,p_version_note:'note'
  });
  assert.equal(response.error,conflict);
});

test('published read throws original SDK error and clears its timeout', async () => {
  const error={code:'PGRST301',status:401,message:'token expired'};
  let cleared=false;
  const query={select(){return this;},eq(){return this;},abortSignal(){return this;},maybeSingle:async()=>({error})};
  const api=loadFactory('repository',{tripId:'fixture',client:{from:()=>query}},{
    AbortController,setTimeout:()=>1,clearTimeout:()=>{cleared=true;}
  });
  await assert.rejects(api.fetchPublishedState(),caught=>caught===error);
  assert.equal(cleared,true);
});

test('version list reads only metadata; selected content has an ID and the same signal', async () => {
  const calls=[],signal=new AbortController().signal;
  const query={
    select(columns){calls.push(['select',columns]);return this;},
    eq(key,value){calls.push(['eq',key,value]);return this;},
    abortSignal(value){assert.equal(value,signal);return this;},
    order(key,options){assert.equal(key,'created_at');assert.equal(options.ascending,false);return this;},
    limit(count){assert.equal(count,50);return {data:[]};},single(){return {data:{content:{html:'selected'}}};}
  };
  const api=loadFactory('repository',{tripId:'fixture',client:{from(table){assert.equal(table,'trip_document_versions');return query;}}});
  await api.readVersionMetadata(signal);
  assert.deepEqual(calls,[['select','id,note,content_size,created_at'],['eq','trip_id','fixture']]);
  calls.length=0;
  await api.readVersionContent(17,signal);
  assert.deepEqual(calls,[['select','content'],['eq','trip_id','fixture'],['eq','id',17]]);
});
