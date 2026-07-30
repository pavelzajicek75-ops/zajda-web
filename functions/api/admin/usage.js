// functions/api/admin/usage.js
//
// GET /api/admin/usage → metriky pro admin dashboard
//
// Počet požadavků se počítá přes functions/_middleware.js, který při
// každém /api/ volání připočítá +1 do KV (reqcount:YYYY-MM-DD). Chyby
// (status >= 500) do errcount:YYYY-MM-DD. Tady se posledních 30 denních
// počítadel sečte. Žádný Cloudflare token, žádný GraphQL.

import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const [storage, requests, errors] = await Promise.all([
    getR2StorageUsage(env),
    getRequestsUsageFromKV(env, 30),
    getErrorsUsageFromKV(env, 30)
  ]);

  return json({
    requestsToday: requests.today,
    requestsDailyLimit: DAILY_LIMIT,
    requestsUsed: requests.used,
    requestsLimit: requests.limit,
    requestsError: requests.error || null,
    errorsToday: errors.today,
    errorsUsed: errors.used,
    errorsError: errors.error || null,
    storageUsedBytes: storage.totalBytes,
    storageLimitBytes: storage.limitBytes,
    buckets: storage.buckets
  });
}

// Cloudflare Workers/Pages Functions Free plán: limit je DENNÍ (ne
// měsíční), resetuje se o půlnoci UTC.
const DAILY_LIMIT = 100000;

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

/* Sečte posledních `days` denních počítadel z KV. Čtení jdou paralelně
   (Promise.all). Vrací i "today" zvlášť — denní limit je to důležité číslo. */
async function getRequestsUsageFromKV(env, days) {
  return readDailyCounters(env, days, 'reqcount:');
}

/* Stejné, ale pro chybová počítadla (errcount:YYYY-MM-DD). */
async function getErrorsUsageFromKV(env, days) {
  return readDailyCounters(env, days, 'errcount:');
}

/* Společná implementace — liší se jen prefixem klíče. */
async function readDailyCounters(env, days, prefix) {
  if (!env.USAGE_KV) {
    return { today: null, used: null, limit: null, error: 'KV binding USAGE_KV chybí' };
  }
  try {
    const now = new Date();
    const keys = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      keys.push(prefix + d.toISOString().slice(0, 10));
    }
    const values = await Promise.all(keys.map(k => env.USAGE_KV.get(k)));
    const used = values.reduce((sum, v) => sum + (v ? (parseInt(v, 10) || 0) : 0), 0);
    const today = values[0] ? (parseInt(values[0], 10) || 0) : 0;
    return { today, used, limit: null, error: null };
  } catch (e) {
    return { today: null, used: null, limit: null, error: String(e) };
  }
}
