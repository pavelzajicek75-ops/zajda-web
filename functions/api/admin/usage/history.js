// functions/api/admin/usage/history.js
//
// GET /api/admin/usage/history?period=week|month
// → [{ label, requests }]
//
// ZMĚNA: dřív se tahalo z Cloudflare GraphQL Analytics API (padalo na
// "401 Authentication error" / "429 Rate limited"). Teď se čte z VLASTNÍHO
// denního počítadla v KV, které plní functions/_middleware.js při každém
// /api/ volání (klíč "reqcount:YYYY-MM-DD") — stejný zdroj dat jako
// functions/api/admin/usage.js. Žádný Cloudflare token, žádný GraphQL,
// žádný rate limit.
//
// Pozn.: počítadlo běží od chvíle, kdy je _middleware.js nasazený — dny
// před nasazením logicky nemají žádná data (zobrazí se jako 0, ne jako
// chyba).

import { requireAdmin, json } from '../../_auth-utils.js';

const MONTHS_CZ = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!env.USAGE_KV) {
    return json({ error: 'KV binding USAGE_KV chybí' }, 500);
  }

  const url = new URL(request.url);
  const period = url.searchParams.get('period') === 'month' ? 'month' : 'week';
  const now = new Date();

  // "Týdny" = posledních 8 týdnů (56 dní), "Měsíce" = posledních 6 měsíců (~185 dní)
  const daysBack = period === 'month' ? 185 : 60;
  const byDay = await getDailyCountsFromKV(env, daysBack, now);

  const points = period === 'week' ? bucketByWeek(byDay, 8, now) : bucketByMonth(byDay, 6, now);
  return json(points);
}

/* Natáhne denní počítadla z KV za posledních `daysBack` dní. Čtení jdou
   paralelně (Promise.all) — i 185 čtení je v pohodě, KV čtení jsou rychlá
   a levná (a navíc je to jen v admin panelu, ne na běžných stránkách). */
async function getDailyCountsFromKV(env, daysBack, now) {
  const keys = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  const values = await Promise.all(keys.map(day => env.USAGE_KV.get('reqcount:' + day)));
  const byDay = {};
  keys.forEach((day, i) => {
    byDay[day] = values[i] ? (parseInt(values[i], 10) || 0) : 0;
  });
  return byDay;
}

function bucketByWeek(byDay, weeksCount, now) {
  const points = [];
  for (let i = weeksCount - 1; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    let sum = 0;
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      sum += byDay[d.toISOString().slice(0, 10)] || 0;
    }

    points.push({ label: fmtDay(weekStart) + '–' + fmtDay(weekEnd), requests: sum });
  }
  return points;
}

function bucketByMonth(byDay, monthsCount, now) {
  const points = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = monthDate.getFullYear() + '-' + String(monthDate.getMonth() + 1).padStart(2, '0');

    let sum = 0;
    for (const day in byDay) {
      if (day.indexOf(monthKey) === 0) sum += byDay[day];
    }

    points.push({ label: MONTHS_CZ[monthDate.getMonth()] + ' ' + monthDate.getFullYear(), requests: sum });
  }
  return points;
}

function fmtDay(d) {
  return d.getDate() + '.' + (d.getMonth() + 1) + '.';
}
