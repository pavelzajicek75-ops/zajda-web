// Zrcadlo fotek: kopie všech fotek z R2 „PHOTOS_R2“ do druhého bucketu „QUOTES_R2“ (předpona photo-mirror/).
// Chrání před omylem (smazaná / přepsaná fotka) — nejde o zálohu mimo Cloudflare, ta je „Záloha všeho na disk“.
//   GET  ?dir=backup|restore           → { total, mirrored, missing:[klíče…], missingCount }
//   POST {dir, keys:[…]} (max 12)      → zkopíruje dané klíče, vrací { copied, failed }
// dir=backup: PHOTOS_R2 → QUOTES_R2/photo-mirror/<klíč>;  dir=restore: zrcadlo → PHOTOS_R2 (jen chybějící).
import { requireAdmin, json } from '../_auth-utils.js';

const PREFIX = 'photo-mirror/';
const isPhoto = k => k.startsWith('gallery-') && /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(k);

async function listAll(bucket, prefix) {
  const out = new Map();
  let cursor, pages = 0;
  while (pages < 20) {
    const l = await bucket.list({ prefix, cursor, limit: 1000 });
    for (const o of l.objects || []) out.set(o.key.slice(prefix.length), o.size);
    pages++;
    if (!l.truncated || !l.cursor) return { map: out, complete: true };
    cursor = l.cursor;
  }
  return { map: out, complete: false };
}

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  if (!env.PHOTOS_R2 || !env.QUOTES_R2) return json({ error: 'Chybí R2 binding PHOTOS_R2 nebo QUOTES_R2' }, 500);
  const dir = new URL(request.url).searchParams.get('dir') === 'restore' ? 'restore' : 'backup';
  const src = await listAll(env.PHOTOS_R2, 'gallery-');
  const mir = await listAll(env.QUOTES_R2, PREFIX + 'gallery-');
  const photos = new Map([...src.map].filter(([k]) => isPhoto('gallery-' + k)).map(([k, v]) => ['gallery-' + k, v]));
  const mirrored = new Map([...mir.map].map(([k, v]) => ['gallery-' + k, v]));
  const missing = dir === 'backup'
    ? [...photos].filter(([k, size]) => mirrored.get(k) !== size).map(([k]) => k)
    : [...mirrored].filter(([k]) => !photos.has(k)).map(([k]) => k);
  return json({ dir, total: photos.size, mirrored: mirrored.size, missingCount: missing.length, missing: missing.slice(0, 400), more: !(src.complete && mir.complete) }, 200);
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  if (!env.PHOTOS_R2 || !env.QUOTES_R2) return json({ error: 'Chybí R2 binding' }, 500);
  let body = {}; try { body = await request.json(); } catch (e) {}
  const dir = body.dir === 'restore' ? 'restore' : 'backup';
  const keys = (Array.isArray(body.keys) ? body.keys : []).map(String).filter(k => isPhoto(k) && !k.includes('..')).slice(0, 12);
  const from = dir === 'backup' ? env.PHOTOS_R2 : env.QUOTES_R2, to = dir === 'backup' ? env.QUOTES_R2 : env.PHOTOS_R2;
  const fromKey = k => dir === 'backup' ? k : PREFIX + k, toKey = k => dir === 'backup' ? PREFIX + k : k;
  let copied = 0; const failed = [];
  for (const k of keys) {
    try {
      const o = await from.get(fromKey(k));
      if (!o) { failed.push(k); continue; }
      await to.put(toKey(k), o.body, { httpMetadata: o.httpMetadata, customMetadata: o.customMetadata });
      copied++;
    } catch (e) { failed.push(k); }
  }
  return json({ copied, failed });
}
