// functions/_middleware.js
//
// Počítá /api/ requesty do KV (reqcount:YYYY-MM-DD).
// Minimalistické — nic co by mohlo shodit request.

export async function onRequest(context) {
  const { request, env, next } = context;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  if (!env.USAGE_KV) {
    return next();
  }

  // Nejdřív zavoláme next() — to je nejdůležitější
  const response = await next();

  // Počítadlo — v try/catch, nikdy nesmí shodit request
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = 'reqcount:' + today;
    const current = parseInt(await env.USAGE_KV.get(key) || '0', 10);
    await env.USAGE_KV.put(key, String(current + 1));
  } catch (e) {
    console.error('USAGE_KV write failed:', e.message);
  }

  return response;
}
