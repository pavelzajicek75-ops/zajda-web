// functions/api/admin/usage-history.js
//
// GET /api/admin/usage-history?period=week|month
// → [{ label, requests, errors, avgResponseMs, storageBytes }, ...]

import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const period = url.searchParams.get('period') === 'month' ? 'month' : 'week';

  if (!env.USAGE_KV) {
    return json({ error: 'KV binding USAGE_KV chybí' }, 500);
  }

  try {
    const points = period === 'month'
      ? await getMonthlyPoints(env)
      : await getWeeklyPoints(env);
    return json(points);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

/* Načte hodnotu pro jeden den — usage: (JSON) nebo reqcount: (číslo) */
async function readDay(env, date) {
  const usageRaw = await env.USAGE_KV.get('usage:' + date);
  if (usageRaw) {
    try { return JSON.parse(usageRaw); } catch { /* fall through */ }
  }
  const reqRaw = await env.USAGE_KV.get('reqcount:' + date);
  if (reqRaw) {
    const n = parseInt(reqRaw, 10) || 0;
    return { requests: n, errors: 0, responseMs: 0 };
  }
  return null;
}

/* Pondělí týdne, do kterého spadá zadané datum (00:00, ISO týden Po–Ne).
   Předchozí verze počítala "týdny" jako rolující 7denní okno couvající
   od aktuálního okamžiku (dnes, dnes-7, dnes-14, ...) — hranice týdne se
   tak každý den posunula a popisek běžně přeskakoval přes měsíc uprostřed
   týdne (např. "29.7.–4.8."), což na první pohled vypadalo jako špatně
   spočítané datum. Týdny teď místo toho vždy sedí na skutečný kalendářní
   týden Pondělí–Neděle, takže popisek je stabilní a dá se srovnat s
   běžným kalendářem. */
function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Ne,1=Po,...,6=So
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

function fmtDayMonth(d) {
  return d.getDate() + '.' + (d.getMonth() + 1) + '.';
}

async function getWeeklyPoints(env) {
  const WEEKS = 8;
  const now = new Date();
  const thisMonday = mondayOf(now);
  const buckets = [];

  // buckets[0] = nejstarší týden, buckets[WEEKS-1] = aktuální (možná ještě neúplný) týden
  for (let w = WEEKS - 1; w >= 0; w--) {
    const monday = new Date(thisMonday);
    monday.setDate(monday.getDate() - w * 7);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(date.getDate() + d);
      if (date > now) break; // dny, co ještě nenastaly, do týdne nepočítat
      days.push(date.toISOString().slice(0, 10));
    }
    buckets.push({ days, monday, sunday, isCurrent: w === 0 });
  }

  const allDates = buckets.map(b => b.days).flat();
  const allData = await Promise.all(allDates.map(d => readDay(env, d)));
  const valMap = new Map();
  allDates.forEach((d, i) => valMap.set(d, allData[i]));

  return buckets.map(b => {
    let requests = 0, errors = 0, responseMs = 0;
    for (const d of b.days) {
      const data = valMap.get(d);
      if (!data) continue;
      requests += data.requests || 0;
      errors += data.errors || 0;
      responseMs += data.responseMs || 0;
    }
    const avgResponseMs = requests > 0 ? Math.round(responseMs / requests) : null;
    const label = fmtDayMonth(b.monday) + '–' + fmtDayMonth(b.sunday);
    return {
      label, requests, errors, avgResponseMs, storageBytes: null,
      isCurrent: b.isCurrent, daysCounted: b.days.length
    };
  });
}

async function getMonthlyPoints(env) {
  const MONTHS = 6;
  const now = new Date();
  const monthLabels = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
  const buckets = [];

  for (let m = MONTHS - 1; m >= 0; m--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (d > now) break;
      days.push(d.toISOString().slice(0, 10));
    }

    const isCurrent = month === now.getMonth() && year === now.getFullYear();
    buckets.push({ days, label: monthLabels[month] + ' ' + year, isCurrent });
  }

  const allDates = buckets.map(b => b.days).flat();
  const allData = await Promise.all(allDates.map(d => readDay(env, d)));
  const valMap = new Map();
  allDates.forEach((d, i) => valMap.set(d, allData[i]));

  return buckets.map(b => {
    let requests = 0, errors = 0, responseMs = 0;
    for (const d of b.days) {
      const data = valMap.get(d);
      if (!data) continue;
      requests += data.requests || 0;
      errors += data.errors || 0;
      responseMs += data.responseMs || 0;
    }
    const avgResponseMs = requests > 0 ? Math.round(responseMs / requests) : null;
    return { label: b.label, requests, errors, avgResponseMs, storageBytes: null, isCurrent: b.isCurrent, daysCounted: b.days.length };
  });
}
