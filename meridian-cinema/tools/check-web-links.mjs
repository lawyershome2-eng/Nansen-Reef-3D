// Static check: every relative import/src in web/ must resolve, under URL semantics
// relative to how server/index.js serves web/ as document root, to a real file.
// This exists because Node's own file-based ESM resolution does NOT match browser
// URL resolution when a repo's directory nesting doesn't match its serving depth
// (bit us once already with ui/icons.js) -- this script checks the thing that
// actually matters (what the browser will request) instead.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { globSync } from 'node:fs';

const ROOT = join(import.meta.dirname, '..', 'web');

function walk(dir, out = []) {
  for (const name of require('node:fs').readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const files = walk(ROOT);

let bad = 0, checked = 0;
const IMPORT_RE = /from\s+['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|new URL\(\s*['"](\.[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g;
const SRC_RE = /\b(?:src|href)\s*=\s*["'](\.[^"']+)["']/g;
const IMPORTMAP_RE = /"imports"\s*:\s*(\{[^}]*\})/;

for (const file of files) {
  const ext = extname(file);
  if (!['.js', '.html'].includes(ext)) continue;
  const text = readFileSync(file, 'utf8');
  const urlPath = '/' + relative(ROOT, file).split(require('node:path').sep).join('/');
  const specs = [];
  let m;
  if (ext === '.js') {
    while ((m = IMPORT_RE.exec(text))) specs.push(m[1] || m[2] || m[3]);
  } else {
    while ((m = SRC_RE.exec(text))) if (text.slice(Math.max(0, m.index - 20), m.index).includes('type="module"') || /\.js["']$/.test(m[0]) || m[1].endsWith('.js') || m[1].endsWith('.css')) specs.push(m[1]);
    const im = IMPORTMAP_RE.exec(text);
    if (im) { try { for (const v of Object.values(JSON.parse(im[1]))) specs.push(v); } catch {} }
  }
  for (const spec of specs) {
    checked++;
    const resolvedUrl = new URL(spec, 'http://x' + urlPath).pathname;
    const diskPath = join(ROOT, resolvedUrl);
    if (!existsSync(diskPath)) { console.log(`MISSING: ${urlPath} -> ${spec} -> ${resolvedUrl}`); bad++; }
  }
}
console.log(`checked ${checked} relative references`);
if (bad) { console.log(`${bad} broken`); process.exit(1); }
console.log('all resolved');
