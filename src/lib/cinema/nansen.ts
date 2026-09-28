// The only module that talks to Nansen. The key stays server-side.

const BASE = "https://api.nansen.ai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class NansenError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, path: string, detail: string) {
    super(`Nansen ${status} on ${path}: ${detail.slice(0, 300)}`);
    this.name = "NansenError";
    this.status = status;
    this.detail = detail.slice(0, 300);
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export class NansenClient {
  creditsRemaining: number | null = null;

  constructor(
    private apiKey: string,
    private log: Pick<Console, "warn"> = console,
  ) {
    if (!apiKey) throw new Error("NANSEN_API_KEY missing");
  }

  async post(path: string, body: unknown, { retries = 2 }: { retries?: number } = {}): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(BASE + path, {
          method: "POST",
          headers: { apikey: this.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20_000),
        });
      } catch (err) {
        if (attempt >= retries) throw err;
        await sleep(1000 * 2 ** attempt);
        continue;
      }

      const rem = res.headers.get("x-nansen-credits-remaining");
      if (rem !== null && rem !== "") {
        const n = Number(rem);
        if (Number.isFinite(n)) this.creditsRemaining = n;
      }

      if (res.ok) return res.json();

      const retryable = res.status === 429 || res.status >= 500;
      const text = await res.text().catch(() => "");
      if (!retryable || attempt >= retries) throw new NansenError(res.status, path, text);
      const ra = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt;
      this.log.warn(`Nansen ${res.status}, retrying in ${wait}ms`);
      await sleep(wait);
    }
  }

  tokenTransfers(args: { chain: string; tokenAddress: string; from: string; to: string; perPage?: number }) {
    return this.post("/api/v1/tgm/transfers", {
      chain: args.chain,
      token_address: args.tokenAddress,
      date: { from: args.from, to: args.to },
      pagination: { page: 1, per_page: args.perPage ?? 40 },
      filters: {
        include_cex: true,
        include_dex: true,
        non_exchange_transfers: true,
        only_smart_money: false,
      },
      order_by: [{ field: "block_timestamp", direction: "DESC" }],
    });
  }

  tokenHolders(args: { chain: string; tokenAddress: string }) {
    return this.post("/api/v1/tgm/holders", {
      chain: args.chain,
      token_address: args.tokenAddress,
      aggregate_by_entity: false,
      label_type: "all_holders",
      pagination: { page: 1, per_page: 10 },
      premium_labels: false,
      order_by: [{ field: "value_usd", direction: "DESC" }],
    });
  }

  tokenDexTrades(args: { chain: string; tokenAddress: string; from: string; to: string; perPage?: number }) {
    return this.post("/api/v1/tgm/dex-trades", {
      chain: args.chain,
      token_address: args.tokenAddress,
      only_smart_money: false,
      date: { from: args.from, to: args.to },
      pagination: { page: 1, per_page: args.perPage ?? 40 },
      order_by: [{ field: "block_timestamp", direction: "DESC" }],
    });
  }

  /** Token God Mode — token information (MC, liquidity, holders, volume, socials). 1 credit. */
  tokenInformation(args: { chain: string; tokenAddress: string; timeframe?: string }) {
    return this.post("/api/v1/tgm/token-information", {
      chain: args.chain,
      token_address: args.tokenAddress,
      timeframe: args.timeframe ?? "1d",
    });
  }

  walletTransactions(args: { address: string; chain: string; from: string; to: string; perPage?: number }) {
    return this.post("/api/v1/profiler/address/transactions", {
      address: args.address,
      chain: args.chain,
      date: { from: args.f
... 
