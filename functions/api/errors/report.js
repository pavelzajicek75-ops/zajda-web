// POST /api/errors/report — veřejné: hlášení chyby JavaScriptu z prohlížeče.
// Celá fronta je v JEDNOM klíči KV (meta:errors); zápis stojí jednu operaci.
// Ochrany (aby to nespotřebovalo denní limit zápisů ani nezahltilo úložiště):
//  – stejná chyba (stránka + zpráva) se jen přičte k počtu, nezakládá nový řádek,
//  – maximálně 25 zápisů denně celkem (počítadlo je ve stejném klíči),
//  – maximálně 40 různých chyb ve frontě, nejstarší vypadne,
//  – limit v paměti: 3 hlášení / 10 min / IP.
const KEY = 'meta:errors';
const MAX_ITEMS = 40;
const DAILY_WRITES = 25;
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  if (arr.length >= 3) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const clean = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  const message = clean(b && b.message, 300);
  if (!message) return json({ error: 'Prázdné hlášení' }, 400);
  let page = '';
  try { const u = new URL(String(b.page || ''), 'https://x.invalid'); page = u.pathname.slice(0, 120); } catch {}
  const where = clean(b && b.where, 200);     // soubor:řádek
  const ua = clean(request.headers.get('User-Agent'), 160);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (tooMany(ip)) return json({ ok: true, skipped: 'rate' });

  const day = new Date().toISOString().slice(0, 10);
  const cur = await env.ARTICLES.get(KEY, { type: 'json' });
  const db = cur && typeof cur === 'object' && Array.isArray(cur.items) ? cur : { day, writes: 0, items: [] };
  if (db.day !== day) { db.day = day; db.writes = 0; }
  if (db.writes >= DAILY_WRITES) return json({ ok: true, skipped: 'daily' });

  const sig = page + '|' + message;
  const it = db.items.find(x => x.sig === sig);
  const now = Date.now();
  if (it) { it.count = (it.count || 1) + 1; it.last = now; it.ua = ua || it.ua; }
  else {
    db.items.unshift({ id: crypto.randomUUID(), sig, page, message, where, ua, count: 1, first: now, last: now });
    if (db.items.length > MAX_ITEMS) db.items.length = MAX_ITEMS;
  }
  db.writes++;
  await env.ARTICLES.put(KEY, JSON.stringify(db));
  return json({ ok: true });
}
