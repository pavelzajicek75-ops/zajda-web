import { requireAdmin, json } from '../_auth-utils.js';

const KEY = 'meta:ideas';
const MAX = 200;

function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

// POST { action:'add', text } | { action:'delete', id } | { action:'edit', id, text }
export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  const cur = await env.ARTICLES.get(KEY, { type: 'json' });
  let list = Array.isArray(cur) ? cur : [];
  const action = body && body.action;

  if (action === 'add') {
    const text = clean(body.text, 1000);
    if (text.length < 2) return json({ error: 'Nápad je prázdný.' }, 400);
    if (list.length >= MAX) return json({ error: 'Máš už ' + MAX + ' nápadů — nějaké smaž nebo převeď na koncept.' }, 400);
    list.unshift({ id: crypto.randomUUID(), text, created: Date.now() });
  } else if (action === 'edit') {
    const text = clean(body.text, 1000);
    const it = list.find(x => x.id === body.id);
    if (!it) return json({ error: 'Nápad nenalezen' }, 404);
    if (text.length < 2) return json({ error: 'Nápad je prázdný.' }, 400);
    it.text = text;
  } else if (action === 'delete') {
    if (!list.some(x => x.id === body.id)) return json({ error: 'Nápad nenalezen' }, 404);
    list = list.filter(x => x.id !== body.id);
  } else {
    return json({ error: 'Neznámá akce' }, 400);
  }
  await env.ARTICLES.put(KEY, JSON.stringify(list));
  return json({ ok: true, ideas: list });
}
