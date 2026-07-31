// functions/_middleware.js
//
// Počítá /api/ requesty do KV (reqcount:YYYY-MM-DD).
// Nezapočítává interní dashboard volání (/api/admin/, /api/verify).
// Zapisuje ~20% requestů, přičítá +5 — 5x méně zápisů do KV.

export async function onRequest(context) {
  const { request, env, next } = context;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  // Nezapočítávat interní dashboard volání
  if (url.pathname.startsWith('/api/admin/') ||
      url.pathname.startsWith('/api/verify')) {
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
      await env.USAGE_KV.put(key, String(current + 5));
    }
  } catch (e) {
    console.error('USAGE_KV write failed:', e.message);
  }

  return response;
}
