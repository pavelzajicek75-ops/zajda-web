// functions/_middleware.js
//
// Počítá /api/ requesty do KV (reqcount:YYYY-MM-DD).
// Nezapočítává interní dashboard volání (/api/admin/, /api/verify).
// Zapisuje ~20% requestů, přičítá +5 — 5x méně zápisů do KV.

// Bezpečnostní hlavičky i pro stránky, které generuje server (úvod, článek, …) —
// soubor public/_headers se na odpovědi z funkcí nevztahuje.
function secure(res) {
  try {
    const h = new Headers(res.headers);
    if (!h.has('X-Content-Type-Options')) h.set('X-Content-Type-Options', 'nosniff');
    if (!h.has('X-Frame-Options')) h.set('X-Frame-Options', 'SAMEORIGIN');
    if (!h.has('Referrer-Policy')) h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!h.has('Permissions-Policy')) h.set('Permissions-Policy', 'camera=(), microphone=(), payment=(), geolocation=(), usb=(), bluetooth=(), serial=(), accelerometer=(), gyroscope=(), magnetometer=(), interest-cohort=()');
    if (!h.has('Cross-Origin-Opener-Policy')) h.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (!h.has('Content-Security-Policy')) h.set('Content-Security-Policy', "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
    if (!h.has('Content-Security-Policy-Report-Only')) h.set('Content-Security-Policy-Report-Only', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org https://server.arcgisonline.com; frame-src https://www.youtube-nocookie.com https://www.openstreetmap.org; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) { return res; }
}

export async function onRequest(context) {
  return secure(await inner(context));
}

async function inner(context) {
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
