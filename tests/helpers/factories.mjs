import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const modules = {
  documentSession: ['document-session.js', 'createDocumentSession'],
  timetable: ['timetable-core.js', 'createTimetableCore'],
  repository: ['trip-repository.js', 'createTripRepository'],
  currency: ['currency.js', 'createCurrencyPolicy'],
  ledger: ['ledger-domain.js', 'createLedgerDomain']
};

// Evaluate the whole source without app HTML, DOM, storage or authentication.
export function loadFactory(name, dependencies = {}, globals = {}) {
  const [file, factory] = modules[name] || [];
  if (!file) throw new Error('Unknown factory: ' + name);
  const source = readFileSync(new URL('../../src/app/' + file, import.meta.url), 'utf8');
  const context = vm.createContext({...globals, dependencies});
  return vm.runInContext(source + '\n' + factory + '(dependencies);', context, {filename:file});
}
