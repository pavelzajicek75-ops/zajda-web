// functions/api/_auth-utils.js
//
// OPRAVA: Přepis z KV sessions na JWT — žádné zápisy do KV, žádné limity.
// Session je teď JWT token podepsaný HMAC-SHA256, tajný klíč se bere
// z env.JWT_SECRET (nebo fallback na ADMIN_PASSWORD — už je v env vars).
// Frontend ukládá token do localStorage jako dřív, middleware ho čte
// z Authorization: Bearer <token> — všechno ostatní zůstává stejné.

/* === JWT — podepsaný HMAC-SHA256 přes Web Crypto API === */

async function getSecret(env) {
  return env.JWT_SECRET || env.ADMIN_PASSWORD || 'fallback-secret-change-me';
}

function base64UrlEncode(bytes) {
  const arr = Array.from(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

export async function signJWT(payload, env) {
  const secret = await getSecret(env);
  const enc = new TextEncoder();

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = { ...payload, iat: now, exp: now + 86400 };

  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(fullPayload)));
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));

  return `${data}.${base64UrlEncode(sig)}`;
}

export async function verifyJWT(token, env) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const secret = await getSecret(env);
    const enc = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const sigValid = await crypto.subtle.verify(
      'HMAC', key, base64UrlDecode(sigB64), enc.encode(data)
    );

    if (!sigValid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));

    // Kontrola expirace
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/* === Session — čte Bearer token a verifikuje JWT === */
export async function getSessionFromRequest(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];
  return await verifyJWT(token, env);
}

/* Kdokoliv přihlášený (admin, editor, viewer...) */
export async function requireAuth(request, env) {
  const session = await getSessionFromRequest(request, env);
  return !!session;
}

/* Jen role "admin" — u původního účtu chybějící role = admin (zpětná kompatibilita) */
export async function requireAdmin(request, env) {
  const session = await getSessionFromRequest(request, env);
  if (!session) return false;
  return session.role === 'admin' || session.role === undefined;
}

/* === Hesla pro pozvané uživatele (PBKDF2 přes Web Crypto API) === */
export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export function generateSalt() {
  return crypto.randomUUID();
}

export function generateTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let pass = '';
  for (let i = 0; i < length; i++) pass += chars[arr[i] % chars.length];
  return pass;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
