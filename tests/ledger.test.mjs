import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadFactory } from './helpers/factories.mjs';

const currency = loadFactory('currency', {schemaVersion:6});
const api = loadFactory('ledger', {...currency,safeDataId:(id,fallback)=>id||fallback,hashText:()=> 'hash',findCategoryId:id=>id});
const plain = value => JSON.parse(JSON.stringify(value));

test('ledger decimal validation rejects precision, malformed commas, nonpositive and unsafe money', () => {
  assert.equal(api.parseLedgerInput(' 14,000 ', 'krw'), 14000);
  assert.equal(api.parseLedgerInput('10.01', 'usd'), 10.01);
  for (const value of ['', ' ', '0', '-1', '1e3', 'Infinity', 'NaN', '1,00', '1.', '원10', '9007199254740992'])
    assert.throws(() => api.parseLedgerInput(value, 'krw'), undefined, value);
  assert.throws(() => api.parseLedgerInput('1.1', 'krw'), /원 단위/);
  assert.throws(() => api.parseLedgerInput('1.001', 'usd'), /둘째 자리/);
  assert.throws(() => api.parseLedgerInput('90071992547409.91', 'usd'), /범위/);
});

test('exchange rates reject numeric round-trip precision loss without restricting exact fractions', () => {
  for (const raw of ['', ' ', '0', '-1', 'bad', '1,45', 'Infinity', '1e3', '1450.1234567890123456789', '9007199254740993', '0.'+'0'.repeat(324)+'1', '1'.repeat(401)])
    assert.throws(() => api.parseLedgerRate(raw), undefined, raw);
  for (const [raw, expected] of [[' 1,450.125 ', 1450.125], ['1450.0000000000000000', 1450], ['0001450.1250', 1450.125], ['0.0000001', .0000001], ['9007199254740991', Number.MAX_SAFE_INTEGER]])
    assert.equal(api.parseLedgerRate(raw), expected, raw);
});

test('ledger exact half-up conversions, zero calculated cents and rate errors', () => {
  assert.equal(api.convertLedgerAmount(14000, 'krw', 1400), 10);
  assert.equal(api.convertLedgerAmount(10, 'usd', 1400), 14000);
  assert.equal(api.convertLedgerAmount(.01, 'usd', 1350), 14);
  assert.equal(api.convertLedgerAmount(1, 'krw', 1400), 0);
  assert.equal(api.convertLedgerAmount(1, 'usd', 1.005), 1);
  for (const rate of [0, -1, Infinity, NaN]) assert.throws(() => api.convertLedgerAmount(10, 'usd', rate));
  assert.throws(() => api.convertLedgerAmount(Number.MAX_SAFE_INTEGER, 'usd', 1400));
});

test('input source is explicit, both amounts ignore global rate, original edit keeps its rate', () => {
  const form = api.emptyExpenseInput(); form.krw = '14000';
  assert.deepEqual(plain(api.calculateExpenseInput(form,1400).money), {amountKrw:14000,amountUsd:10,amountSource:'krw',appliedExchangeRate:1400});
  form.usd = '10';
  assert.deepEqual(plain(api.calculateExpenseInput(form,NaN).money), {amountKrw:14000,amountUsd:10,amountSource:'both',appliedExchangeRate:null});
  form.krw = ''; assert.equal(api.calculateExpenseInput(form,1500).money.amountKrw,15000);
  form.usd = ''; assert.equal(api.calculateExpenseInput(form,1500).empty,true);
  form.original = {amountKrw:1.49,amountUsd:0,amountSource:'krw',appliedExchangeRate:1350};
  assert.deepEqual(plain(api.calculateExpenseInput(form,1500).money),form.original);
  form.touched=true; form.krw='1.49'; assert.equal(api.calculateExpenseInput(form,1500).money,undefined);
});

test('legacy migration preserves original precision and is deterministic and idempotent', () => {
  const old=[{id:'a',amount:1.49,currency:'KRW'},{id:'b',amount:.01,currency:'USD'}];
  const converted=plain(api.normalizeExpenses(old,[],1350,5));
  assert.equal(converted[0].amountKrw,1.49);assert.equal(converted[0].amountUsd,0);
  assert.equal(converted[1].amountKrw,14);assert.equal(converted[1].amountUsd,.01);
  assert.deepEqual(plain(api.normalizeExpenses(old,[],1350,5)),converted);
  assert.deepEqual(plain(api.normalizeExpenses(converted,[],1500,6)),converted);
  assert.equal(api.sumLedgerAmounts([{amountUsd:.1},{amountUsd:.2}],'amountUsd'),.3);
  assert.equal(api.formatLedgerSum([{amountKrw:9007199254740991},{amountKrw:9007199254740991}],'krw'),'₩18,014,398,509,481,982');
  assert.equal(api.formatLedgerSum([{amountUsd:.1},{amountUsd:.2}],'usd'),'$0.30');
});

test('schema 6 rejects missing, damaged and contradictory money instead of silently migrating', () => {
  const valid={amountKrw:14000,amountUsd:10,amountSource:'usd',appliedExchangeRate:1400};
  for(const patch of [{amountKrw:null},{amountUsd:0},{amountSource:'invalid'},{appliedExchangeRate:null},{amountKrw:1.5},{amountKrw:15000},{amountSource:'both'},{amountSource:'both',appliedExchangeRate:null,amountUsd:1.001}])
    assert.throws(()=>api.normalizeExpenses([{...valid,...patch}],[],1400,6));
  assert.throws(()=>api.normalizeExpenses([{amount:10,currency:'USD'}],[],1400,6));
  assert.throws(()=>api.normalizeExpenses({},[],1400,6));
});

test('server incremental migration matches installed RPC and checks schema under the row lock', async () => {
  const setup=await readFile(new URL('../supabase_setup.sql',import.meta.url),'utf8');
  const migration=await readFile(new URL('../migrations/20261024_ledger_schema_guard.sql',import.meta.url),'utf8');
  const body=source=>source.replaceAll('\r\n','\n').match(/function public.save_trip_document\([\s\S]*?\n\$\$;/)[0];
  assert.equal(body(migration),body(setup));
  assert.match(body(setup),/for update;[\s\S]*incoming_schema_version < stored_schema_version[\s\S]*insert into public.trip_document_versions/);
  assert.match(body(setup),/is_trip_editor/);assert.match(body(setup),/p_expected_revision <> current_revision/);
});
