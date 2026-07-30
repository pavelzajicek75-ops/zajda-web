// functions/api/admin/usage/history.js
//
// GET /api/admin/usage/history?period=week|month
// → [{ label, requests, errors, avgResponseMs, storageBytes }, ...]
//
// Vrací denní agregáty z KV (usage:YYYY-MM-DD) seskupené po týdnech
// (period=week, posledních 8) nebo měsících (period=month, posledních 6).
// storageBytes je null — historii úložiště v KV netvoříme.

import { requireAdmin, json } from '../../_auth-utils.js';

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

/* Týdny: posledních 8 týdnů (56 dní), každý týden = 7 dní zpět. */
async function getWeeklyPoints(env) {
  const WEEKS = 8;
  const now = new Date();
  const keys = [];
  const buckets = [];

  for (let w = WEEKS - 1; w >= 0; w--) {
    const bucket = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (w * 7 + d));
      const key = 'usage:' + date.toISOString().slice(0, 10);
      keys.push(key);
      bucket.push(key);
    }
    buckets.push(bucket);
  }

  const values = await Promise.all(keys.map(k => env.USAGE_KV.get(k)));
  const valMap = new Map();
  keys.forEach((k, i) => {
    valMap.set(k, values[i] ? JSON.parse(values[i]) : null);
  });

  return buckets.map((bucket, i) => {
    let requests = 0, errors = 0, responseMs = 0;
    for (const k of bucket) {
      const d = valMap.get(k);
      if (!d) continue;
      requests += d.requests || 0;
      errors += d.errors || 0;
      responseMs += d.responseMs || 0;
    }
    const avgResponseMs = requests > 0 ? Math.round(responseMs / requests) : null;
    const oldest = new Date(now);
    oldest.setDate(oldest.getDate() - (i * 7 + 6));
    const label = oldest.getDate() + '.' + (oldest.getMonth() + 1) + '.';
    return { label, requests, errors, avgResponseMs, storageBytes: null };
  });
}

/* Měsíce: posledních 6 kalendářních měsíců. */
async function getMonthlyPoints(env) {
  const MONTHS = 6;
  const now = new Date();
  const monthLabels = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
  const buckets = [];
  const keys = [];

  for (let m = MONTHS - 1; m >= 0; m--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const bucket = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (d > now) break;
      const key = 'usage:' + d.toISOString().slice(0, 10);
      keys.push(key);
      bucket.push(key);
    }

    buckets.push({ bucket, label: monthLabels[month] + ' ' + year });
  }

  const values = await Promise.all(keys.map(k => env.USAGE_KV.get(k)));
  const valMap = new Map();
  keys.forEach((k, i) => {
    valMap.set(k, values[i] ? JSON.parse(values[i]) : null);
  });

  return buckets.map(b => {
    let requests = 0, errors = 0, responseMs = 0;
    for (const k of b.bucket) {
      const d = valMap.get(k);
      if (!d) continue;
      requests += d.requests || 0;
      errors += d.errors || 0;
      responseMs += d.responseMs || 0;
    }
    const avgResponseMs = requests > 0 ? Math.round(responseMs / requests) : null;
    return { label: b.label, requests, errors, avgResponseMs, storageBytes: null };
  });
}
