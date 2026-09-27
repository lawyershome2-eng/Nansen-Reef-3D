// The only file that talks to Nansen. Key stays server-side.
const BASE = 'https://api.nansen.ai';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class NansenClient {
  constructor(apiKey, log = console) {
    if (!apiKey) throw new Error('NANSEN_API_KEY missing');
    this.apiKey = apiKey;
    this.log = log;
    this.creditsRemaining = null;
  }

  async post(path, body, { retries = 3 } = {}) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { apikey: this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const rem = res.headers.get('x-nansen-credits-remaining');
      if (rem !== null) this.creditsRemaining = Number(rem);

      if (res.ok) return res.json();

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= retries) {
        const text = await res.text().catch(() => '');
        throw new Error(`Nansen ${res.status} on ${path}: ${text.slice(0, 300)}`);
      }
      const ra = Number(res.headers.get('retry-after'));
      const wait = (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt);
      this.log.warn(`Nansen ${res.status}, retrying in ${wait}ms`);
      await sleep(wait);
    }
  }

  smartMoneyDexTrades({ chains, minUsd = 0, perPage = 50 }) {
    const filters = minUsd > 0 ? { trade_value_usd: { min: minUsd } } : undefined;
    return this.post('/api/v1/smart-money/dex-trades', {
      chains,
      ...(filters && { filters }),
      pagination: { page: 1, per_page: perPage },
      order_by: [{ field: 'block_timestamp', direction: 'DESC' }],
    });
  }
}
