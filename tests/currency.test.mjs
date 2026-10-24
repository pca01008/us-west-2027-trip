import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const currency = await readFile(new URL('../src/app/currency.js', import.meta.url), 'utf8');
const ledger = await readFile(new URL('../src/app/ledger.js', import.meta.url), 'utf8');
const arithmetic = ledger.slice(0, ledger.indexOf('  // End ledger arithmetic.'));
function runtime(base='KRW',quote='JPY',schemaVersion=7) {
  const context=vm.createContext({});
  vm.runInContext('const CONFIG='+JSON.stringify({schemaVersion,ledger:{currencies:{base,quote}}})+';\n'+currency+arithmetic,context);
  return context;
}
test('new trip currencies use their actual minor units and exact half-up conversions',()=>{
  const yen=runtime();
  assert.equal(yen.convertLedgerAmount(105,'krw',10),11);
  assert.equal(yen.convertLedgerAmount(100,'usd',9.5),950);
  assert.throws(()=>yen.parseLedgerInput('1.01','usd'),/정수/);
  assert.equal(yen.formatLedgerSum([{amountUsd:100},{amountUsd:2}],'usd'),'¥102');
  const eur=runtime('EUR','USD');
  assert.equal(eur.convertLedgerAmount(10,'usd',0.925),9.25);
  assert.equal(eur.parseLedgerInput('9.25','krw'),9.25);
  assert.equal(eur.formatLedgerSum([{amountKrw:9.25}],'krw'),'€9.25');
  const kwd=runtime('KRW','KWD');
  assert.equal(kwd.parseLedgerInput('0.123','usd'),0.123);
  assert.equal(kwd.convertLedgerAmount(1,'krw',4000),0);
  assert.throws(()=>kwd.parseLedgerInput('0.1234','usd'),/3자리/);
});
test('currency mismatch cannot reinterpret old data, drafts, or offline imports',()=>{
  const yen=runtime();
  assert.throws(()=>yen.assertCurrencyPair({schemaVersion:6}),{code:'DOCUMENT_CURRENCY'});
  assert.throws(()=>yen.assertCurrencyPair({schemaVersion:7}),{code:'DOCUMENT_CURRENCY'});
  assert.throws(()=>yen.assertCurrencyPair({schemaVersion:7,currencyCodes:{base:'JPY',quote:'KRW'}}),{code:'DOCUMENT_CURRENCY'});
  assert.doesNotThrow(()=>yen.assertCurrencyPair({schemaVersion:7,currencyCodes:{base:'KRW',quote:'JPY'}}));
  assert.deepEqual(JSON.parse(JSON.stringify(yen.currencyMetadata())),{currencyCodes:{base:'KRW',quote:'JPY'}});
  const legacy=runtime('KRW','USD',6);
  assert.doesNotThrow(()=>legacy.assertCurrencyPair({schemaVersion:5}));
  assert.equal(JSON.stringify(legacy.currencyMetadata()),'{}');
  assert.throws(()=>runtime('KRW','JPY',6),/schemaVersion 7/);
  assert.throws(()=>runtime('JPY','JPY'),/통화 코드/);
  assert.throws(()=>runtime('XYZ','USD'),/통화 코드/);
});
