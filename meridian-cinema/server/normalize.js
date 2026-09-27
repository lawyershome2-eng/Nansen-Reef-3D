// Nansen raw trade -> CinemaEvent. Nothing downstream may know Nansen's shape.
const QUOTE = new Set([
  'USDC', 'USDT', 'DAI', 'USDE', 'FDUSD', 'PYUSD', 'USDS', 'USD1', 'USDC.E',
  'WETH', 'ETH', 'WSOL', 'SOL', 'WBNB', 'BNB', 'WBTC', 'CBBTC',
]);

function parseTs(s) {
  if (!s) return Date.now();
  const hasZone = /(Z|[+-]\d\d:?\d\d)$/.test(s);
  const t = Date.parse(hasZone ? s : s.replace(' ', 'T') + 'Z');
  return Number.isFinite(t) ? t : Date.now();
}

// A DEX trade has one trader and a token pair, so `to` stays null.
// Side heuristic: if the bought token is a stable or major, the trader is
// selling the other token. Otherwise the trader is buying the bought token.
export function normalizeDexTrade(t) {
  const usd = Number(t.trade_value_usd) || 0;
  if (usd <= 0 || !t.transaction_hash) return null;

  const bought = String(t.token_bought_symbol || '').toUpperCase();
  const sold = String(t.token_sold_symbol || '').toUpperCase();
  const isSell = QUOTE.has(bought) && !QUOTE.has(sold);

  const token = isSell
    ? { symbol: t.token_sold_symbol, address: t.token_sold_address }
    : { symbol: t.token_bought_symbol, address: t.token_bought_address };

  const label = t.trader_address_label || 'Smart Money';
  return {
    id: [t.chain, t.transaction_hash, t.trader_address, t.token_bought_address,
         t.token_sold_address, t.token_bought_amount].join(':'),
    timestamp: parseTs(t.block_timestamp),
    chain: t.chain,
    usd,
    side: isSell ? 'sell' : 'buy',
    token,
    from: {
      address: t.trader_address,
      label,
      kind: /fund/i.test(label) ? 'fund' : 'smart',
    },
    to: null,
    metadata: { txHash: t.transaction_hash, source: 'nansen:smart-money/dex-trades' },
  };
}

export function normalizeDexTrades(resp) {
  const rows = Array.isArray(resp?.data) ? resp.data : [];
  return rows.map(normalizeDexTrade).filter(Boolean);
}
