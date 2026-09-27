// Synthetic smart-money trades so the whole pipeline runs with no API key.
const TOKENS = [
  ['SOL', 'So11111111111111111111111111111111111111112', 'solana'],
  ['JUP', 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', 'solana'],
  ['BONK', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', 'solana'],
  ['PEPE', '0x6982508145454ce325ddbe47a25d4ec3d2311933', 'ethereum'],
  ['LINK', '0x514910771af9ca656af840dff83e8264ecf986ca', 'ethereum'],
  ['AERO', '0x940181a94a35a4569e4529a3cdfb74e38fd98631', 'base'],
];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
let n = 0;

export function mockEvent({ big = false } = {}) {
  const [symbol, address, chain] = pick(TOKENS);
  // log-uniform between $500 and $200k, with a rare heavy tail
  let usd = 10 ** rand(2.7, 5.3);
  if (big) usd = 10 ** rand(6.3, 7.1);
  else if (Math.random() < 0.03) usd *= 10;
  const fund = Math.random() < 0.15;
  const id = `mock:${Date.now()}:${n++}`;
  return {
    id,
    timestamp: Date.now(),
    chain,
    usd: Math.round(usd),
    side: Math.random() < 0.55 ? 'buy' : 'sell',
    token: { symbol, address },
    from: {
      address: '0x' + Math.random().toString(16).slice(2, 12).padEnd(10, '0'),
      label: fund ? 'Fund' : 'Smart Trader',
      kind: fund ? 'fund' : 'smart',
    },
    to: null,
    metadata: { txHash: id, source: 'mock' },
  };
}
