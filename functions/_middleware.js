// functions/_middleware.js
//
// Počítá /api/ requesty do KV (reqcount:YYYY-MM-DD).
// Zapisuje jen každý 5. request — 5x méně zápisů, šetří KV limit.

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
    const today = new Date().toISOString().slice(0, 10);
    const key = 'reqcount:' + today;
    const current = parseInt(await env.USAGE_KV.get(key) || '0', 10);
    const newCount = current + 1;

    // Zapisuj jen každý 5. request — 5x méně zápisů do KV
    if (newCount % 5 === 0) {
      await env.USAGE_KV.put(key, String(newCount));
    }
  } catch (e) {
    console.error('USAGE_KV write failed:', e.message);
  }

  return response;
}
