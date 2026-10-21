// Publish only browser assets; keep review evidence and helper scripts under docs/.
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';

const source = new URL('../docs/ui-concepts/', import.meta.url);
const target = new URL('../ui-preview/', import.meta.url);
await mkdir(new URL('previews/', target), { recursive: true });
const textFiles = ['index.html', 'a.html', 'b.html', 'c.html', 'concepts.css', 'review.css', 'concepts.js', 'data.js'];
for (const file of textFiles) {
  let contents = await readFile(new URL(file, source), 'utf8');
  contents = contents.replaceAll('../../assets/', '../assets/');
  if (file.endsWith('.html')) contents = contents.replace('<head>', '<head><meta name="robots" content="noindex,nofollow">');
  await writeFile(new URL(file, target), contents, 'utf8');
}
for (const variant of ['a', 'b', 'c']) {
  for (const size of ['desktop', 'mobile']) {
    const file = `previews/${variant}-${size}.png`;
    await copyFile(new URL(file, source), new URL(file, target));
  }
}
console.log('Prepared ui-preview/: 8 browser source files and 6 comparison images.');
