// CinemaEvent -> physical parameters. All tuning lives here.
export const SPECIES = ['small', 'medium', 'big', 'shark']; // index is what the renderer receives

// What a body means. The clownfish and the cleaner shrimp already live in the
// tank; the rest are the trade fish. The shark is not a trade. It crosses on
// its own clock.
export const BRACKETS = [
  { id: 'shrimp', title: 'Shrimp', body: 'Cleaner shrimp, and the smallest chromis', means: 'Dust. Under about $1,000.' },
  { id: 'wallet', title: 'Wallet', body: 'Chromis', means: 'An ordinary wallet.' },
  { id: 'smart', title: 'Smart trader', body: 'Anthias', means: 'A labeled smart trader.' },
  { id: 'kol', title: 'KOL', body: 'Clownfish on the anemone', means: 'They stay put. Everyone in the tank can see them.' },
  { id: 'whale', title: 'Whale', body: 'A large anthias', means: 'A heavy print, from about $100,000 up.' },
  { id: 'institution', title: 'Institution', body: 'A heavy, slower anthias', means: 'A fund.' },
  { id: 'shark', title: 'Shark', body: 'A long anthias, crossing alone', means: 'Rare. The shoals dive and a ring runs the surface.' },
];

const BRACKET_SPECIES = { shrimp: 0, wallet: 1, smart: 2, institution: 2, whale: 3 };
const BRACKET_SCALE = { shrimp: 0.62, wallet: 0.9, smart: 1.05, institution: 1.28, whale: 1.55 };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// FNV-1a, so a token always gets the same swim lane
export function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

// $100 -> 0, $10M -> 1 on a log scale, so a $10M trade is visibly bigger
// than a $1k one without becoming absurd.
export function usdToT(usd) {
  return clamp((Math.log10(Math.max(Number(usd) || 0, 1)) - 2) / 5, 0, 1);
}

export function speciesFor(t) {
  return t < 0.35 ? 0 : t < 0.6 ? 1 : t < 0.8 ? 2 : 3;
}

export function bracketFor(ev) {
  const t = usdToT(ev?.usd);
  const kind = ev?.from?.kind;
  if (kind === 'fund') return t >= 0.9 ? 'whale' : 'institution';
  if (t >= 0.75) return 'whale';
  if (kind === 'smart') return 'smart';
  if (t < 0.22) return 'shrimp';
  return 'wallet';
}

// buy and in swim with the current. sell and out swim against it.
// transfer is neither: it still crosses the tank, but the heading comes from
// the pair, not from pretending the move was a sell.
export function dirFor(ev) {
  if (ev?.side === 'buy' || ev?.side === 'in') return 1;
  if (ev?.side === 'sell' || ev?.side === 'out') return -1;
  const h = hash01(`${ev?.from?.address || ''}|${ev?.to?.address || ''}|${ev?.token?.address || ''}`);
  return h < 0.5 ? -1 : 1;
}

export function eventToParams(ev) {
  const t = usdToT(ev.usd);
  const bracket = bracketFor(ev);
  const scale = (0.8 + t * 4.0) * (BRACKET_SCALE[bracket] || 1);
  const from = ev.from || { kind: 'wallet', label: '', address: '' };
  const actorWeight = from.kind === 'fund' ? 0.6 : 0.3;
  const fund = from.kind === 'fund';
  const side = ev.side;
  const rush = side === 'buy' ? 0.8 : side === 'in' ? 0.3 : 0;
  const cruise = side === 'transfer' ? 0.82 : 1;
  return {
    t,
    scale,
    bracket,
    mass: scale ** 3,
    species: BRACKET_SPECIES[bracket] ?? speciesFor(t),
    // heavier things accelerate slower, funds cruise a bit faster
    maxSpeed: (3.2 + rush) * (fund ? 1.2 : 1) * (1.15 - 0.35 * t) * cruise,
    accel: 6 / (0.6 + t * 1.6),
    lifetime: 25 + 35 * t,
    score: Math.log10((Number(ev.usd) || 0) + 1) + actorWeight,
    behavior: side === 'transfer' ? 'drift' : t >= 0.8 ? 'heavy' : fund ? 'predator' : 'cruise',
    lane: { y: hash01(ev.token?.address || ev.token?.symbol || 'x'), z: hash01(ev.chain || 'x') },
    dir: dirFor(ev),
  };
}
