// POST /api/photos/restore — vrátí fotku (nebo její náhled) do úložiště pod PŮVODNÍM klíčem.
// Používá ho skript obnova.mjs z úplné zálohy. Jen admin. Nic nemaže; existující soubor
// se nepřepíše, dokud není overwrite=1.
// multipart: key, file, overwrite?
import { requireAdmin, json } from '../_auth-utils.js';

const KEY_RE = /^(thumbs\/)?gallery-[A-Za-z0-9_-]{1,100}\/[A-Za-z0-9_.-]{1,160}$/;
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif' };

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  try {
    const fd = await request.formData();
    const key = String(fd.get('key') || '');
    const file = fd.get('file');
    if (!KEY_RE.test(key) || key.indexOf('..') >= 0) return json({ error: 'Neplatný klíč' }, 400);
    if (!file || typeof file === 'string') return json({ error: 'Chybí soubor' }, 400);
    if (fd.get('overwrite') !== '1' && await env.PHOTOS_R2.head(key)) return json({ ok: true, skipped: true });
    const ext = key.split('.').pop().toLowerCase();
    await env.PHOTOS_R2.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type && file.type !== 'application/octet-stream' ? file.type : (TYPES[ext] || 'image/jpeg') } });
    return json({ ok: true, skipped: false });
  } catch (e) { return json({ error: e.message }, 500); }
}
