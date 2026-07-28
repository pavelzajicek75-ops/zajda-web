// functions/api/_auth-utils.js
//
// Sdílené pomocné funkce pro ověřování — importují se z ostatních
// endpointů (admin/usage.js, admin/users.js, admin/users/invite.js,
// data/folders.js, auth/login.js, auth/me.js), ať to není na 6 místech
// napsané 6x jinak.
//
// OPRAVA: getSessionFromRequest() dřív hledala session v cookie
// ("admin_token" = base64(sessionId:timestamp)), ale skutečné přihlášení
// (viz functions/api/verify.js) posílá token jako "Authorization: Bearer
// <token>" hlavičku, kde token JE PŘÍMO sessionId v env.SESSIONS — žádná
// cookie, žádné base64, žádný ":" oddělovač. Proto všechno přes
// requireAuth/requireAdmin dostávalo 401 (cookie tam nikdy nebyla).
// Teď se čte úplně stejně jako ve verify.js, aby oboje sedělo na stejnou
// session.

/* === Session — čte Bearer token stejně jako functions/api/verify.js === */
export async function getSessionFromRequest(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];
  try {
    const raw = await env.SESSIONS.get(token);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* Kdokoliv přihlášený (admin, editor, viewer...) */
export async function requireAuth(request, env) {
  const session = await getSessionFromRequest(request, env);
  return !!session;
}

/* Jen role "admin" — u tvého původního (jediného) účtu se role do session
   neukládala vůbec, takže chybějící role = považujeme za admin (zpětná
   kompatibilita s tím, co teď máš). Noví pozvaní lidé už roli mají vždy. */
export async function requireAdmin(request, env) {
  const session = await getSessionFromRequest(request, env);
  if (!session) return false;
  return session.role === 'admin' || session.role === undefined;
}

/* === Hesla pro nově pozvané uživatele (PBKDF2 přes Web Crypto API) ===
   Tvůj původní jediný účet (ADMIN_USERNAME/ADMIN_PASSWORD) tohle vůbec
   nepoužívá a nemusí — zůstává přesně jak je, jen prosté porovnání
   s proměnnými prostředí. Tohle je JEN pro další pozvané lidi, co se
   ukládají do KV (ADMIN_USERS), kde by čisté heslo být nemělo. */
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

/* Vygeneruje čitelné dočasné heslo pro nově pozvanou osobu (bez matoucích
   znaků jako 0/O, 1/l/I) — vrátí se JEN JEDNOU v odpovědi na pozvání,
   nikde se neukládá v čitelné podobě. */
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
