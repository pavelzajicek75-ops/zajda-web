// functions/api/admin/usage.js
//
// GET /api/admin/usage → metriky pro admin dashboard
//
// Čte denní JSON agregáty z KV (usage:YYYY-MM-DD), které zapisuje
// _middleware.js. Vrací:
//   - requestsToday, requestsUsed (30 dní), trend vs včera
//   - errorsToday, errorsUsed, errorRate %
//   - avgResponseMs (dnes + 30 dní)
//   - topEndpoints (top 5 dnes)
//   - hourlyDistribution (dnes, 0-23)
//   - R2 storage (velikost + objekty per bucket)

import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const [storage, usage] = await Promise.all([
    getR2StorageUsage(env),
    getUsageData(env, 30)
  ]);

  return json({
    // Požadavky
    requestsToday: usage.today.requests,
    requestsYesterday: usage.yesterday.requests,
    requestsTrend: usage.trend,
    requestsUsed: usage.used30.requests,
    requestsDailyLimit: DAILY_LIMIT,
    requestsError: usage.error,

    // Chyby
    errorsToday: usage.today.errors,
    errorsUsed: usage.used30.errors,
    errorRate: usage.today.errorRate,
    errorsError: usage.error,

    // Doba odpovědi
    avgResponseMsToday: usage.today.avgResponseMs,
    avgResponseMs30: usage.used30.avgResponseMs,
    responseError: usage.error,

    // Top endpointy (dnes)
    topEndpoints: usage.today.topEndpoints,

    // Rozdělení dle hodiny (dnes)
    hourlyDistribution: usage.today.hours,

    // R2
    storageUsedBytes: storage.totalBytes,
    storageLimitBytes: storage.limitBytes,
    buckets: storage.buckets
  });
}

const DAILY_LIMIT = 100000;

/* === R2 STORAGE === */
async function getR2StorageUsage(env) {
  const buckets = [
    { name: 'zajda-photos', binding: env.PHOTOS_R2 },
    { name: 'zajda-quotes', binding: env.QUOTES_R2 }
  ];

  const results = [];
  let totalBytes = 0;

  for (const b of buckets) {
    if (!b.binding) {
      results.push({ name: b.name, bytes: 0, objects: 0, error: 'binding chybí' });
      continue;
    }
    try {
      let bytes = 0, objects = 0, cursor = undefined, truncated = true;
      while (truncated) {
        const page = await b.binding.list({ cursor, limit: 1000 });
        for (const obj of page.objects) {
          bytes += obj.size || 0;
          objects++;
        }
        truncated = page.truncated;
        cursor = page.cursor;
      }
      results.push({ name: b.name, bytes, objects });
      totalBytes += bytes;
    } catch (e) {
      results.push({ name: b.name, bytes: 0, objects: 0, error: String(e) });
    }
  }

  const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024;
  return { buckets: results, totalBytes, limitBytes: FREE_TIER_BYTES };
}

/* === USAGE DATA Z KV === */
async function getUsageData(env, days) {
  if (!env.USAGE_KV) {
    return {
      error: 'KV binding USAGE_KV chybí',
      today: emptyDay(), yesterday: emptyDay(),
      used30: emptyAgg(), trend: null
    };
  }

  try {
    const now = new Date();
    const keys = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      keys.push('usage:' + d.toISOString().slice(0, 10));
    }

    const values = await Promise.all(keys.map(k => env.USAGE_KV.get(k)));
    const days30 = values.map(v => v ? JSON.parse(v) : null);

    const today = parseDay(days30[0]);
    const yesterday = parseDay(days30[1]);

    let trend = null;
    if (yesterday.requests > 0) {
      trend = Math.round(((today.requests - yesterday.requests) / yesterday.requests) * 100);
    }

    const used30 = aggregateDays(days30);

    return { today, yesterday, trend, used30, error: null };
  } catch (e) {
    return {
      error: String(e),
      today: emptyDay(), yesterday: emptyDay(),
      used30: emptyAgg(), trend: null
    };
  }
}

function parseDay(raw) {
  if (!raw) return emptyDay();

  const requests = raw.requests || 0;
  const errors = raw.errors || 0;
  const responseMs = raw.responseMs || 0;
  const avgResponseMs = requests > 0 ? Math.round(responseMs / requests) : null;
  const errorRate = requests > 0 ? Math.round((errors / requests) * 1000) / 10 : null;

  const endpoints = raw.endpoints || {};
  const topEndpoints = Object.entries(endpoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([endpoint, count]) => ({ endpoint, count }));

  return {
    requests, errors, errorRate,
    avgResponseMs, topEndpoints,
    hours: raw.hours || {}
  };
}

function aggregateDays(days) {
  let requests = 0, errors = 0, responseMs = 0;
  for (const d of days) {
    if (!d) continue;
    requests += d.requests || 0;
    errors += d.errors || 0;
    responseMs += d.responseMs || 0;
  }
  const avgResponseMs = requests > 0 ? Math.round(responseMs / requests) : null;
  return { requests, errors, avgResponseMs };
}

function emptyDay() {
  return {
    requests: 0, errors: 0, errorRate: null,
    avgResponseMs: null, topEndpoints: [], hours: {}
  };
}

function emptyAgg() {
  return { requests: 0, errors: 0, avgResponseMs: null };
}
