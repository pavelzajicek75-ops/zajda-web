// functions/api/data/article-draft.js
//
// Serverová záloha rozepsaného konceptu článku. Stejný princip jako
// existující /api/data/folders.js (malý JSON přes KV) — jen jiný klíč.
//
// ⚠️ DŮLEŽITÉ: binding env.DATA_KV níže je odhad podle pojmenování ve
// zbytku projektu (USAGE_KV pro metriky). Podívej se, jaký binding
// používá tvůj existující /api/data/folders.js, a přepiš ho tady na
// STEJNÝ název (v wrangler.toml i tady v kódu), ať oba endpointy míří
// do stejného KV namespace.
//
// GET    /api/data/article-draft?key=articleDraft:xyz   → { ...draft } | {}
// POST   /api/data/article-draft?key=articleDraft:xyz   body: draft JSON
// DELETE /api/data/article-draft?key=articleDraft:xyz

import { requireAdmin, json } from '../_auth-utils.js';

const KEY_PREFIX = 'articledraft:';
// Koncept, co se 14 dní nikdo nedotkne, se sám uklidí z KV — ať tam
// nezůstávají navěky zapomenuté rozepsané konce.
const TTL_SECONDS = 60 * 60 * 24 * 14;

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ error: 'Chybí parametr key' }, 400);
  if (!env.DATA_KV) return json({ error: 'KV binding DATA_KV chybí' }, 500);

  try {
    const raw = await env.DATA_KV.get(KEY_PREFIX + key);
    if (!raw) return json({});
    return json(JSON.parse(raw));
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ error: 'Chybí parametr key' }, 400);
  if (!env.DATA_KV) return json({ error: 'KV binding DATA_KV chybí' }, 500);

  try {
    const body = await request.json();
    body.updated = Date.now();
    await env.DATA_KV.put(KEY_PREFIX + key, JSON.stringify(body), { expirationTtl: TTL_SECONDS });
    return json({ ok: true, updated: body.updated });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ error: 'Chybí parametr key' }, 400);
  if (!env.DATA_KV) return json({ error: 'KV binding DATA_KV chybí' }, 500);

  try {
    await env.DATA_KV.delete(KEY_PREFIX + key);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
