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

async function getWeeklyPoints(env) {
  const WEEKS = 8;
  const now = new Date();
  const buckets = [];

  // buckets[0] = nejstarší týden, buckets[7] = aktuální týden
  for (let w = WEEKS - 1; w >= 0; w--) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (w * 7 + d));
      days.push(date.toISOString().slice(0, 10));
    }
    buckets.push(days);
  }

  const allDates = buckets.flat();
  const allData = await Promise.all(allDates.map(d => readDay(env, d)));
  const valMap = new Map();
  allDates.forEach((d, i) => valMap.set(d, allData[i]));

  return buckets.map((days, i) => {
    let requests = 0, errors = 0, responseMs = 0;
    for (const d of days) {
      const data = valMap.get(d);
      if (!data) continue;
      requests += data.requests || 0;
      errors += data.errors || 0;
      responseMs += data.responseMs || 0;
    }
    const avgResponseMs = requests > 0 ? Math.round(responseMs / requests) : null;

    // OPRAVA: i=0 je nejstarší týden (w=7), i=7 je aktuální (w=0)
    // Nejstarší den v týdnu = now - (w * 7 + 6), kde w = WEEKS - 1 - i
    const w = WEEKS - 1 - i;
    const oldest = new Date(now);
    oldest.setDate(oldest.getDate() - (w * 7 + 6));
    const newest = new Date(now);
    newest.setDate(newest.getDate() - (w * 7));
    const label = oldest.getDate() + '.' + (oldest.getMonth() + 1) + '.–' +
                  newest.getDate() + '.' + (newest.getMonth() + 1) + '.';
    return { label, requests, errors, avgResponseMs, storageBytes: null };
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

    buckets.push({ days, label: monthLabels[month] + ' ' + year });
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
    return { label: b.label, requests, errors, avgResponseMs, storageBytes: null };
  });
}
