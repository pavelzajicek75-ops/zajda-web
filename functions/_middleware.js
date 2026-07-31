// functions/_middleware.js
//
// Počítá /api/ requesty do KV (reqcount:YYYY-MM-DD).
// Zapisuje jen ~20% requestů (náhodně), přičítá vždy +5.
// Číslo je přibližné (±5), ale 5x méně zápisů do KV.

export async function onRequest(context) {
  const { request, env, next } = context;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  if (!env.USAGE_KV) {
    return next();
  }

  const response = await next();

  try {
    // 20% šance na zápis — 5x méně zápisů do KV
    if (Math.random() < 0.2) {
      const today = new Date().toISOString().slice(0, 10);
      const key = 'reqcount:' + today;
      const current = parseInt(await env.USAGE_KV.get(key) || '0', 10);
      // +5 protože počítáme každý 5. request v průměru
      await env.USAGE_KV.put(key, String(current + 5));
    }
  } catch (e) {
    console.error('USAGE_KV write failed:', e.message);
  }

  return response;
}
