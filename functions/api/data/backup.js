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

import { collectBackup } from './_collect.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let backup;
  try {
    backup = await collectBackup(env, { fresh: true });
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
