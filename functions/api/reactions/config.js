// /functions/api/reactions/config.js
//
// Definice reakcí (emoji + text) pod články — konfigurovatelné z adminu,
// místo aby byly natvrdo zapsané v kódu article.html. Veřejná stránka
// článku si je při každém načtení stáhne přes GET (proto GET nemá auth —
// potřebuje to fungovat pro každého návštěvníka bez přihlášení). Změny
// (přidání/úprava/smazání reakce) může ukládat jen přihlášený admin.
//
// Úložiště: jeden záznam v KV (ARTICLES, stejný namespace jako ostatní
// obsahové věci) pod klíčem "config:reactions" — pole objektů
// { key, emoji, label }. "key" je stabilní identifikátor používaný i
// v uložených počtech reakcí u článků (article.reactions[key]) — když se
// key nezmění, staré nasbírané počty zůstanou po přejmenování emoji/textu
// zachované; když se key smaže/přejmenuje, historické počty pod starým
// klíčem v datech článků zůstanou (jen se přestanou nikde zobrazovat),
// nemažou se zpětně.

import { requireAdmin, json } from '../_auth-utils.js';

const CONFIG_KEY = 'config:reactions';

const DEFAULT_REACTIONS = [
  { key: 'rocket', emoji: '🐇', label: 'Ten nemá čas' },
  { key: 'bunny', emoji: '🧨', label: 'To bude rachot' },
  { key: 'laugh', emoji: '🎯', label: 'Ten je úplně jasnej' },
  { key: 'mindblown', emoji: '🤯', label: 'To by mi prasknul' },
  { key: 'touched', emoji: '🔁', label: 'Čtu si to znovu' }
];

export async function onRequestGet(context) {
  const { env } = context;
  const stored = await env.ARTICLES.get(CONFIG_KEY, { type: 'json' });
  return json({ reactions: (stored && stored.reactions) || DEFAULT_REACTIONS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Neplatné tělo požadavku' }, 400);
  }

  const reactions = Array.isArray(body.reactions) ? body.reactions : null;
  if (!reactions || !reactions.length) {
    return json({ error: 'Musí zůstat aspoň jedna reakce' }, 400);
  }

  // Základní kontrola tvaru dat — ať se do KV nedostane něco rozbitého,
  // co by pak spadlo na veřejné stránce článku.
  const seen = new Set();
  for (const r of reactions) {
    if (!r || typeof r.key !== 'string' || !r.key.trim()) {
      return json({ error: 'Každá reakce potřebuje neprázdný klíč' }, 400);
    }
    if (seen.has(r.key)) {
      return json({ error: 'Duplicitní klíč reakce: ' + r.key }, 400);
    }
    seen.add(r.key);
    if (typeof r.emoji !== 'string' || !r.emoji.trim()) {
      return json({ error: 'Reakce "' + r.key + '" potřebuje emoji' }, 400);
    }
    if (typeof r.label !== 'string' || !r.label.trim()) {
      return json({ error: 'Reakce "' + r.key + '" potřebuje text' }, 400);
    }
  }

  const clean = reactions.map(r => ({ key: r.key.trim(), emoji: r.emoji.trim(), label: r.label.trim() }));
  await env.ARTICLES.put(CONFIG_KEY, JSON.stringify({ reactions: clean, updated: Date.now() }));
  return json({ reactions: clean });
}
