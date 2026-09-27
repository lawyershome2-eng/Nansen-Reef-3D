export class Seen {
  constructor(cap = 5000) { this.cap = cap; this.set = new Set(); this.q = []; }
  has(id) { return this.set.has(id); }
  add(id) {
    if (this.set.has(id)) return false;
    this.set.add(id); this.q.push(id);
    if (this.q.length > this.cap) this.set.delete(this.q.shift());
    return true;
  }
  filter(events) { return events.filter((e) => this.add(e.id)); }
}
