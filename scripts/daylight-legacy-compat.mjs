import assert from 'node:assert/strict';

// Keep the legacy UI while giving its existing save/import paths the same
// metadata semantics as Daylight. Do not transplant navigation or renderers.
function block(source,name){
 const start=source.indexOf('  function '+name+'(');
 assert.ok(start>=0,'Missing function '+name);
 const ends=['\n  function ','\n  async function '].map(marker=>source.indexOf(marker,start+1)).filter(index=>index>=0);
 assert.ok(ends.length,'Missing boundary after '+name);
 return {start,end:Math.min(...ends)};
}
export function preserveDaylightMetadata(legacy,candidate){
 let result=legacy.replaceAll('\r\n','\n');
 candidate=candidate.replaceAll('\r\n','\n');
 assert.ok(!result.includes('function initializeDaylight()'),'Expected legacy UI');
 for(const name of ['checklistItems','checklistShape','patchChecklist','stateSummary','buildDiff']){
  const from=block(candidate,name),to=block(result,name);
  result=result.slice(0,to.start)+candidate.slice(from.start,from.end)+result.slice(to.end);
 }
 assert.ok(result.includes("label.dataset.checkImportant='true'"));
 return result;
}
