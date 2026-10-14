import { hit } from '../_ratelimit.js';
// /functions/api/articles/view.js
//
// Zaznamená jedno zobrazení článku. Volá se z veřejné stránky článku
// (article.html) při každém úspěšném načtení. Počítadlo se ukládá přímo
// do záznamu článku v KV (stejné místo, kde jsou title/content/atd.) —
// díky tomu ho admin vidí zdarma i v /api/articles/list, bez nutnosti
// tahat další data zvlášť.
//
// POZOR na známé omezení: čtení+zápis do KV není atomické. Při dvou
// zobrazeních naprosto současně (během pár milisekund) se teoreticky
// jedno připočtení může "ztratit". Pro osobní blog s běžnou návštěvností
// je to zanedbatelné; pro web s vysokou návštěvností by bylo potřeba
// řešit přes Durable Objects nebo Cloudflare Analytics Engine.

import { refLabel, addRef } from './_ref.js';
import { sampleFactor } from '../_kv-budget.js';

export async function onRequestPost(context) {
  if (hit('view', context.request, 60)) return new Response(JSON.stringify({ error: 'Moc rychle, zkus to za chvíli.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  const { request, env } = context;

  let id, ref = '';
  try {
    const body = await request.json();
    id = body && body.id;
    ref = body && typeof body.ref === 'string' ? body.ref : '';
  } catch {
    return Response.json({ error: 'Neplatné tělo požadavku' }, { status: 400 });
  }
  if (!id) return Response.json({ error: 'Chybí id' }, { status: 400 });

  // Šetření zápisů: při vysoké dnešní spotřebě se zapíše jen každé k-té zobrazení (s váhou k).
  const k = await sampleFactor(context);
  if (k > 1 && Math.random() >= 1 / k) return Response.json({ sampled: true });

  const key = `article:${id}`;
  const existing = await env.ARTICLES.get(key, { type: 'json' });
  if (!existing) return Response.json({ error: 'Nenalezeno' }, { status: 404 });

  const views = (existing.views || 0) + k;
  // Týdenní počítadla (viewsByWeek) jsou ve STEJNÉM záznamu a ve stejném
  // zápisu jako celkový počet — nestojí žádný další zápis do KV navíc.
  // Drží se jen posledních 26 týdnů, ať záznam neroste donekonečna.
  const week = isoWeekKey(new Date());
  const byWeek = { ...(existing.viewsByWeek || {}) };
  byWeek[week] = (byWeek[week] || 0) + k;
  const keys = Object.keys(byWeek).sort();
  while (keys.length > 26) delete byWeek[keys.shift()];
  // Zdroj návštěvy (Google, WhatsApp…) — do stejného záznamu a stejného zápisu, žádný zápis navíc.
  let ownHost = '';
  try { ownHost = new URL(request.url).hostname.toLowerCase().replace(/^www\./, ''); } catch {}
  let refs = existing.refs;
  for (let i = 0; i < k; i++) refs = addRef(refs, refLabel(ref, ownHost));
  const updated = { ...existing, views, viewsByWeek: byWeek, refs };
  await env.ARTICLES.put(key, JSON.stringify(updated));

  return Response.json({ views });
}

// ISO týden, např. "2026-W41" (pondělí = začátek týdne, UTC).
export function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}
