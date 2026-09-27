import { EventEmitter } from 'node:events';
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Seen } from './dedupe.js';
import { normalizeDexTrades } from './normalize.js';
import { mockEvent } from './mock.js';

// One shared poller. Every browser gets the same stream, so credits scale with
// time, not with viewers.
export class Poller extends EventEmitter {
  constructor(cfg, nansen, log = console) {
    super();
    this.cfg = cfg;
    this.nansen = nansen;
    this.log = log;
    this.seen = new Seen();
    this.recent = [];
    this.status = { mode: cfg.mode, state: 'idle', lastPollAt: 0, calls: 0, error: null };
    this.timers = new Set();
  }

  publish(ev) {
    this.recent.push(ev);
    if (this.recent.length > 200) this.recent.shift();
    if (this.cfg.record && ev.metadata?.source !== 'mock') {
      mkdirSync(dirname(this.cfg.recordFile), { recursive: true });
      appendFileSync(this.cfg.recordFile, JSON.stringify(ev) + '\n');
    }
    this.emit('event', ev);
  }

  later(ms, fn) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  setStatus(patch) {
    Object.assign(this.status, patch);
    this.emit('status', this.status);
  }

  start() {
    if (this.cfg.mode === 'live') return this.startLive();
    if (this.cfg.mode === 'replay') return this.startReplay();
    return this.startMock();
  }

  startMock() {
    this.setStatus({ state: 'running' });
    let count = 0;
    const tick = () => {
      count++;
      this.publish(mockEvent({ big: count % 45 === 0 }));
      this.later(600 + Math.random() * 1800, tick);
    };
    tick();
  }

  startReplay() {
    const file = this.cfg.recordFile;
    if (!existsSync(file)) {
      this.log.warn(`No ${file}, falling back to mock. Run live with RECORD=1 first.`);
      return this.startMock();
    }
    const evs = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      .sort((a, b) => a.timestamp - b.timestamp);
    if (!evs.length) return this.startMock();
    this.setStatus({ state: 'running' });
    const speed = this.cfg.replaySpeed;
    const loop = () => {
      const t0 = evs[0].timestamp;
      const stamp = Date.now();
      evs.forEach((e, i) => {
        this.later((e.timestamp - t0) / speed, () => {
          // fresh id and time each loop so dedupe and clients treat it as new
          this.publish({ ...e, id: `${e.id}#${stamp}`, timestamp: Date.now() });
          if (i === evs.length - 1) this.later(1500, loop);
        });
      });
    };
    loop();
  }

  async startLive() {
    this.setStatus({ state: 'running' });
    let first = true;
    const poll = async () => {
      try {
        const raw = await this.nansen.smartMoneyDexTrades({
          chains: this.cfg.chains, minUsd: this.cfg.minUsd, perPage: this.cfg.perPage,
        });
        let fresh = this.seen.filter(normalizeDexTrades(raw)).sort((a, b) => a.timestamp - b.timestamp);
        if (first) { fresh = fresh.slice(-this.cfg.firstBatch); first = false; }
        // spread the batch across the poll window so fish arrive continuously
        const gap = fresh.length ? (this.cfg.pollMs * 0.9) / fresh.length : 0;
        fresh.forEach((ev, i) => this.later(i * gap, () => this.publish(ev)));
        this.setStatus({
          state: 'running', lastPollAt: Date.now(), calls: this.status.calls + 1, error: null,
          creditsRemaining: this.nansen.creditsRemaining,
        });
      } catch (err) {
        this.log.error(String(err.message || err));
        this.setStatus({ state: 'degraded', error: String(err.message || err) });
      }
      this.later(this.cfg.pollMs, poll);
    };
    poll();
  }

  stop() { this.timers.forEach(clearTimeout); this.timers.clear(); }
}
