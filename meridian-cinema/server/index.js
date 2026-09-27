import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Poller } from './poller.js';
import { NansenClient } from './nansen.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

// tiny .env loader, no dependency
if (existsSync(join(ROOT, '.env'))) {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const env = process.env;
const cfg = {
  mode: env.MERIDIAN_MODE || 'mock',
  port: Number(env.PORT) || 8787,
  pollMs: Math.max(5000, Number(env.POLL_MS) || 10000),
  chains: (env.CHAINS || 'solana,ethereum,base').split(',').map((s) => s.trim()),
  minUsd: Number(env.MIN_USD) || 1000,
  perPage: Math.min(1000, Number(env.PER_PAGE) || 50),
  firstBatch: Number(env.FIRST_BATCH) || 20,
  record: env.RECORD === '1',
  recordFile: join(ROOT, 'data', 'session.ndjson'),
  replaySpeed: Number(env.REPLAY_SPEED) || 8,
};

const nansen = cfg.mode === 'live' ? new NansenClient(env.NANSEN_API_KEY) : null;
const poller = new Poller(cfg, nansen);
const clients = new Set();

const send = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
poller.on('event', (ev) => clients.forEach((c) => send(c, 'cinema', ev)));
poller.on('status', (s) => clients.forEach((c) => send(c, 'status', s)));

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream', '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, clients: clients.size, ...poller.status }));
  }

  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    send(res, 'status', poller.status);
    poller.recent.slice(-30).forEach((ev) => send(res, 'cinema', ev)); // warm start
    clients.add(res);
    const hb = setInterval(() => res.write(': hb\n\n'), 15000);
    req.on('close', () => { clearInterval(hb); clients.delete(res); });
    return;
  }

  // static files from /web (and the aquarium fork once you drop it in)
  let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!rel) rel = 'index.html';
  const file = resolve(join(ROOT, 'web', rel));
  if (!file.startsWith(join(ROOT, 'web'))) { res.writeHead(403); return res.end(); }
  try {
    const s = await stat(file);
    const target = s.isDirectory() ? join(file, 'index.html') : file;
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream' });
    res.end(await readFile(target));
  } catch { res.writeHead(404); res.end('not found'); }
});

server.listen(cfg.port, () => {
  console.log(`Meridian on http://localhost:${cfg.port}  mode=${cfg.mode}`);
  poller.start();
});
