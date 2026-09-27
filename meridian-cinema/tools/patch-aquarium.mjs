// usage: node tools/patch-aquarium.mjs web/aquarium/aquarium.js [web/aquarium/aquarium.html]
// Two one-line insertions into aquarium.js, plus one script tag in aquarium.html.
// Fails loudly if an anchor is missing or ambiguous. Writes a .bak the first time.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';

const [jsPath, htmlPath] = process.argv.slice(2);
if (!jsPath) { console.error('usage: patch-aquarium.mjs aquarium.js [aquarium.html]'); process.exit(1); }

const EDITS = [
  {
    name: 'draw hook',
    marker: 'window.Meridian.drawModel',
    anchor: 'fish.drawPrep(fishConstInUse);',
    insert: (a) => a + '\n        if (window.Meridian && window.Meridian.drawModel(ff, fish, fishPer, fishInfo, g.globals.fishSetting, g.drawLasers, fishScale)) { continue; }',
  },
  {
    name: 'step hook',
    marker: 'window.Meridian.step',
    anchor: 'g_requestId = requestAnimationFrame(onAnimationFrame);',
    insert: (a) => 'if (window.Meridian) { window.Meridian.step(elapsedTime); }\n    ' + a,
  },
];

let src = readFileSync(jsPath, 'utf8');
if (!existsSync(jsPath + '.bak')) copyFileSync(jsPath, jsPath + '.bak');
for (const e of EDITS) {
  if (src.includes(e.marker)) { console.log(`skip ${e.name}: already patched`); continue; }
  const n = src.split(e.anchor).length - 1;
  if (n !== 1) { console.error(`FAIL ${e.name}: anchor found ${n} times`); process.exit(2); }
  src = src.replace(e.anchor, e.insert(e.anchor));
  console.log(`ok ${e.name}`);
}
writeFileSync(jsPath, src);

if (htmlPath) {
  let html = readFileSync(htmlPath, 'utf8');
  const tag = '<script type="module" src="/src/bridge.js"></script>';
  if (html.includes('/src/bridge.js')) console.log('skip html: already has bridge');
  else if (!html.includes('</body>')) { console.error('FAIL html: no </body>, add the tag by hand:\n' + tag); process.exit(3); }
  else { writeFileSync(htmlPath, html.replace('</body>', tag + '\n</body>')); console.log('ok html'); }
}
