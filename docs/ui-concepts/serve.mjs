import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.UI_PREVIEW_PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if(url.pathname === '/') { res.writeHead(302, { Location:'/docs/ui-concepts/index.html' }).end(); return; }
  const relative = url.pathname.slice(1);
  if (!/^(docs\/ui-concepts\/[\w./-]+|assets\/[\w.-]+|icons\/[\w.-]+|index\.html|trip-config\.js)$/.test(relative) || relative.includes('..') || relative.endsWith('.mjs')) {
    res.writeHead(404).end(); return;
  }
  try {
    let body = await readFile(path.join(root, relative));
    if (relative === 'index.html') body = body.toString().replace(/<script id="pwaRegistration"[^>]*><\/script>/, '').replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, '');
    if (relative === 'trip-config.js') body = body.toString().replace(/supabase: \{[\s\S]*?\n  \},/, 'supabase: {},');
    res.writeHead(200, { 'Content-Type': types[path.extname(relative)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log(`UI concepts: http://127.0.0.1:${port}/docs/ui-concepts/index.html`));
