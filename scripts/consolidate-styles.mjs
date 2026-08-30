import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'index.html');
const source = await readFile(file, 'utf8');
const matches = [...source.matchAll(/<style(?<attrs>[^>]*)>(?<css>[\s\S]*?)<\/style>/g)];

if (matches.length <= 1) {
  console.log('스타일시트가 이미 단일 블록입니다.');
  process.exit(0);
}

const layerNames = ['base', 'itinerary', 'timeline', 'session', 'modern', 'features', 'ledger'];
if (matches.length !== layerNames.length) {
  throw new Error(`예상한 7개가 아닌 ${matches.length}개 스타일 블록을 찾았습니다.`);
}

const layered = matches.map((match, index) => {
  const label = match.groups.attrs.match(/id="([^"]+)"/)?.[1] || layerNames[index];
  const css = match.groups.css.replace(/\s*!important\b/g, '');
  return `@layer ${layerNames[index]} {\n/* ${label} */${css}\n}`;
}).join('\n\n');

const utilities = `
/* Only state utilities that must beat every component layer remain important. */
[hidden],.hidden{display:none!important}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;

const consolidated = `<style id="trip-app-styles">\n@layer ${layerNames.join(',')};\n${layered}\n${utilities}</style>`;
const first = matches[0];
const last = matches.at(-1);
const start = first.index;
const end = last.index + last[0].length;
await writeFile(file, source.slice(0, start) + consolidated + source.slice(end), 'utf8');

console.log(`스타일 통합 완료: ${matches.length}개 블록 → 1개 블록`);
