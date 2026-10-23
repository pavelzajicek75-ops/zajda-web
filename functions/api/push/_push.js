// Web Push bez obsahu zprávy (jen „klepnutí“): prohlížeč po něm sám stáhne /api/push/latest
// a ukáže oznámení. Stačí tedy podpis VAPID (ES256), žádné šifrování obsahu.
// Úložiště: odběratelé v JEDNOM klíči KV (meta:push), klíče VAPID v meta:vapid → žádné výpisy (list).
export const SUBS_KEY = 'meta:push';
export const VAPID_KEY = 'meta:vapid';
export const LAST_KEY = 'meta:push-last';
export const MAX_SUBS = 500;

export function b64u(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64u(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(str).length + 3) % 4);
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Vrací { publicKey (base64url, 65 bajtů), privateJwk }. Při prvním použití vygeneruje a uloží (1 zápis).
export async function getVapid(env) {
  const cur = await env.ARTICLES.get(VAPID_KEY, { type: 'json' });
  if (cur && cur.publicKey && cur.privateJwk) return cur;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const v = { publicKey, privateJwk, created: Date.now() };
  await env.ARTICLES.put(VAPID_KEY, JSON.stringify(v));
  return v;
}

async function vapidHeader(vapid, endpoint, subject) {
  const aud = new URL(endpoint).origin;
  const enc = new TextEncoder();
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + claims)));
  return 'vapid t=' + head + '.' + claims + '.' + b64u(sig) + ', k=' + vapid.publicKey;
}

// Pošle „klepnutí“ jednomu odběrateli. Vrací HTTP status (nebo 0 při chybě spojení).
export async function sendTap(vapid, endpoint, subject) {
  try {
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Authorization': await vapidHeader(vapid, endpoint, subject), 'TTL': '86400', 'Urgency': 'normal' } });
    return r.status;
  } catch (e) { return 0; }
}

export function validEndpoint(e) {
  if (typeof e !== 'string' || e.length > 800) return false;
  try { return new URL(e).protocol === 'https:'; } catch { return false; }
}

// === Oznámení pro správce (komentář / zpráva „Napiš mi“) ===
export const ADMIN_SUBS_KEY = 'meta:push-admin';
export const ADMIN_LAST_KEY = 'meta:push-admin-last';
const ADMIN_TEXT = { comment: 'Nový komentář čeká na schválení', message: 'Nová zpráva z „Napiš mi“', login: 'Přihlášení do adminu z nového zařízení' };

// Pošle „klepnutí“ zařízením správce. Nikdy nevyhodí chybu (komentář/zpráva se tím nesmí rozbít).
export async function notifyAdmin(env, kind, origin) {
  try {
    const cur = await env.ARTICLES.get(ADMIN_SUBS_KEY, { type: 'json' });
    const subs = cur && Array.isArray(cur.subs) ? cur.subs : [];
    if (!subs.length) return;
    await env.ARTICLES.put(ADMIN_LAST_KEY, JSON.stringify({ kind, text: ADMIN_TEXT[kind] || 'Něco nového v adminu', at: Date.now() }));
    const vapid = await getVapid(env);
    const res = await Promise.all(subs.map(async s => ({ s, st: await sendTap(vapid, s.endpoint, origin || 'https://example.com') })));
    const gone = new Set(res.filter(r => r.st === 404 || r.st === 410).map(r => r.s.endpoint));
    if (gone.size) await env.ARTICLES.put(ADMIN_SUBS_KEY, JSON.stringify({ subs: subs.filter(s => !gone.has(s.endpoint)) }));
  } catch (e) { /* ticho */ }
}
