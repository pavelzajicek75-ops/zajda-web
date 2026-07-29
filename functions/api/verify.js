// functions/api/verify.js
//
// OPRAVA: Přepis z KV sessions na JWT — žádné zápisy ani čtení z KV.
// Token je JWT, verifikuje se kryptograficky přes HMAC-SHA256.
// Frontend volá fetch('/api/verify', ...) — cesta nezměněna.
// Odpověď je stejný JSON tvar { ok: true/false } jako dřív.

import { verifyJWT } from './_auth-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return Response.json({ ok: false, error: 'Chybí Authorization hlavička' }, { status: 401 });
  }

  const token = match[1];
  const session = await verifyJWT(token, env);

  if (!session) {
    return Response.json({ ok: false, error: 'Neplatný nebo expirovaný token' }, { status: 401 });
  }

  return Response.json({ ok: true, user: session.user, role: session.role });
}
