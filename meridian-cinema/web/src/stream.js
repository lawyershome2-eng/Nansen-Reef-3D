// Data clock. Never touches rendering.
export function connect({ onEvent, onStatus, url = '/api/stream' }) {
  const es = new EventSource(url); // reconnects automatically after drops
  es.addEventListener('cinema', (m) => onEvent(JSON.parse(m.data)));
  es.addEventListener('status', (m) => onStatus?.(JSON.parse(m.data)));
  es.onerror = () => onStatus?.({ state: 'reconnecting' });
  return () => es.close();
}
