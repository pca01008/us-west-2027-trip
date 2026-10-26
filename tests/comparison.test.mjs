import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFactory } from './helpers/factories.mjs';

const api=loadFactory('comparison',{
  TRIP_DAYS:[{date:'2027-01-21'},{date:'2027-01-22'}],
  CURRENCY_CODES:{base:'KRW',quote:'USD'},currencyLabel:slot=>slot==='krw'?'원화':'달러'
});
const event=(id,dayIndex=0)=>({id,key:id,dayIndex,index:0,stay:'',kind:'기타',time:'09:00',title:id,detail:'',warning:'',mapName:'',map:'',photos:[]});
const summary=schedules=>({days:['first','second'],schedules,checks:[],expenses:[],categories:[],exchangeRate:1450});

test('date-only moves remain visible even when flattened event order is unchanged',()=>{
  const before=summary([event('a'),event('b',1)]),after=structuredClone(before);
  after.schedules[0].dayIndex=1;
  const groups=api.compareSummaries(before,after);
  assert.equal(groups.length,1);
  assert.equal(groups[0].items.length,1);
  assert.match(groups[0].items[0],/2027-01-21 → 2027-01-22/);
  assert.equal(before.schedules[0].dayIndex,0);
});

test('date moves, within-day order and metadata are independent comparison dimensions',()=>{
  const before=summary([event('a'),event('b')]);
  const after=summary([event('b'),{...event('a',1),title:'changed'}]);
  const changes=api.compareSummaries(before,after).flatMap(group=>group.items);
  assert.equal(changes.length,3);
  assert.ok(changes.some(text=>text.includes('날짜:')));
  assert.ok(changes.some(text=>text.includes('제목:')));
  assert.ok(changes.some(text=>text.includes('표시 순서 변경')));
  assert.equal(api.compareSummaries(before,structuredClone(before)).length,0);
});
