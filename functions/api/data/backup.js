// functions/api/data/backup.js
//
// GET /api/data/backup — stáhne úplně všechen obsah webu (články, milníky
// časové osy, "O Zajdovi", hlavní sekce, podsekce, metadata fotogalerií,
// citáty) jako jeden JSON soubor ke stažení. Nestahuje samotné soubory fotek
// z R2 (to by bylo obrovské) — jen metadata a URL, kterými se na ně
// odkazuje; fotky samotné zůstávají bezpečně v R2 bez ohledu na tohle.
//
// Jen pro přihlášeného admina — je to celý obsah webu najednou.

import { requireAdmin, json } from '../_auth-utils.js';

async function listAll(kv, prefix) {
  const out = [];
  const list = await kv.list({ prefix });
  for (const key of list.keys) {
    const data = await kv.get(key.name, { type: 'json' });
    if (data) out.push(data);
  }
  return out;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const backup = {
    exportedAt: new Date().toISOString(),
    version: 1
  };

  try {
    backup.articles = await listAll(env.ARTICLES, 'article:');
    backup.timeline = await listAll(env.ARTICLES, 'timeline:');
    backup.about = await env.ARTICLES.get('about:zajda', { type: 'json' });
    backup.sections = await listAll(env.SUBSECTIONS, 'section:');
    backup.subsections = await listAll(env.SUBSECTIONS, 'subsection:');

    if (env.PHOTOS) {
      backup.galleries = await listAll(env.PHOTOS, 'gallery:');
    }

    if (env.QUOTES_R2) {
      backup.quotes = [];
      const quotesList = await env.QUOTES_R2.list({ prefix: 'quotes/' });
      for (const obj of quotesList.objects) {
        const file = await env.QUOTES_R2.get(obj.key);
        if (file) {
          try { backup.quotes.push(await file.json()); } catch (e) { /* přeskočit poškozený záznam */ }
        }
      }
    }
  } catch (e) {
    return json({ error: 'Záloha se nepodařila: ' + (e && e.message ? e.message : String(e)) }, 500);
  }

  const filename = 'zajda-zaloha-' + new Date().toISOString().slice(0, 10) + '.json';
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + filename + '"'
    }
  });
}
