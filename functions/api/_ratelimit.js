// Jednoduchý limit v paměti (bez zápisů do KV): max `max` volání za `winMs` na IP a jméno.
const store = new Map();
export function ipOf(request) { return request.headers.get('CF-Connecting-IP') || 'unknown'; }
function arr(name, ip, winMs) {
  const k = name + '|' + ip, now = Date.now();
  const a = (store.get(k) || []).filter(t => now - t < winMs);
  store.set(k, a);
  if (store.size > 10000) store.clear();
  return a;
}
// Zapíše volání a vrátí true, když už je limit překročen.
export function hit(name, request, max, winMs = 10 * 60 * 1000) {
  const ip = ipOf(request), a = arr(name, ip, winMs);
  if (a.length >= max) return true;
  a.push(Date.now()); return false;
}
// Jen zjistí (nezapisuje) a zvlášť se zapíše přes record() — pro počítání neúspěšných přihlášení.
export function isLimited(name, request, max, winMs = 10 * 60 * 1000) { return arr(name, ipOf(request), winMs).length >= max; }
export function record(name, request, winMs = 10 * 60 * 1000) { arr(name, ipOf(request), winMs).push(Date.now()); }
