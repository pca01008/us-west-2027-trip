import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const code=source.split('// Daylight metadata calculations are pure')[1].split('// End of pure Daylight metadata calculations.')[0];
const context=vm.createContext({});vm.runInContext(code.slice(code.indexOf('function validCalendarDate')),context);
const {validCalendarDate,validStay,staysOnDate,importantIncomplete}=context;
test('숙박 날짜는 실재하는 달력 날짜만 허용한다',()=>{
 for(const value of ['2027-02-30','2027-02-29','2027-13-01','2027-00-12','2027-1-01','bad',''])assert.equal(validCalendarDate(value),false,value);
 assert.equal(validCalendarDate('2028-02-29'),true);
 assert.equal(validStay('2027-01-21','2027-02-01','2027-01-21','2027-01-31'),true);
 for(const end of ['2027-01-21','2027-01-20','2027-02-02','2027-02-30'])assert.equal(validStay('2027-01-21',end,'2027-01-21','2027-01-31'),false);
 assert.equal(validStay('2027-01-20','2027-01-23','2027-01-21','2027-01-31'),false);
});
test('체크인은 포함, 체크아웃은 제외하며 중복 숙소를 숨기지 않는다',()=>{
 const a={start:'2027-01-21',end:'2027-01-24'},b={start:'2027-01-24',end:'2027-01-29'};
 assert.equal(staysOnDate([a,b],'2027-01-20').length,0);
 assert.equal(staysOnDate([a,b],'2027-01-21')[0],a);
 assert.equal(staysOnDate([a,b],'2027-01-23')[0],a);
 assert.equal(staysOnDate([a,b],'2027-01-24')[0],b);
 assert.equal(staysOnDate([a,b],'2027-01-29').length,0);
 assert.equal(staysOnDate([a,{...b,start:'2027-01-23'}],'2027-01-23').length,2);
});
test('중요 미완료만 원본 순서로 표시하며 입력을 변경하지 않는다',()=>{
 const items=[{id:1,important:true,checked:false},{id:2,important:false,checked:false},{id:3,important:true,checked:true},{id:4,important:true,checked:false}];
 const before=JSON.stringify(items);assert.deepEqual(Array.from(importantIncomplete(items),x=>x.id),[1,4]);assert.equal(JSON.stringify(items),before);
 assert.equal(importantIncomplete([]).length,0);items[0].checked=true;items[3].checked=true;assert.equal(importantIncomplete(items).length,0);
});
