// POST /api/photos/thumb-put — admin. Form: key (klíč původní fotky), thumb (obrázek).
// Uloží náhled pod thumbs/<key>, ale jen k existující fotce a jen pokud tam ještě není.
import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  const key = String(form.get('key') || '');
  const thumb = form.get('thumb');
  if (!/^gallery-[\w.-]+\/[\w.-]+$/.test(key) || key.includes('..')) return json({ error: 'Neplatný klíč' }, 400);
  if (!thumb || typeof thumb === 'string') return json({ error: 'Chybí náhled' }, 400);
  if (thumb.size > 600 * 1024) return json({ error: 'Náhled je příliš velký' }, 400);
  if (!(await env.PHOTOS_R2.head(key))) return json({ error: 'Fotka neexistuje' }, 404);
  if (await env.PHOTOS_R2.head('thumbs/' + key)) return json({ ok: true, skipped: true });
  await env.PHOTOS_R2.put('thumbs/' + key, await thumb.arrayBuffer(), { httpMetadata: { contentType: 'image/jpeg' } });
  return json({ ok: true });
}
