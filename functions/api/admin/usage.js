// functions/api/admin/usage.js
//
// GET /api/admin/usage → {
//   requestsUsed,
//   subrequests,
//   errors,
//   durationMs,
//   requestsLimit,
//   storageUsedBytes,
//   storageLimitBytes,
//   buckets: [...]
// }

import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const [storage, requests] = await Promise.all([
    getR2StorageUsage(env),
    getRequestsUsage(env).catch(e => ({
      used: null,
      subrequests: null,
      errors: null,
      durationMs: null,
      limit: null,
      error: String(e)
    }))
  ]);

  return json({
    requestsUsed: requests.used,
    subrequests: requests.subrequests,
    errors: requests.errors,
    durationMs: requests.durationMs,
    requestsLimit: requests.limit,
    requestsError: requests.error || null,
    storageUsedBytes: storage.totalBytes,
    storageLimitBytes: storage.limitBytes,
    buckets: storage.buckets
  });
}

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

/* Počet spuštění Workers/Pages Functions za posledních 30 dní. */
async function getRequestsUsage(env) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    throw new Error('CF_API_TOKEN nebo CF_ACCOUNT_ID není nastaveno');
  }

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);

  const scriptFilter = env.CF_WORKER_SCRIPT_NAME
    ? `scriptName: "${env.CF_WORKER_SCRIPT_NAME}"`
    : '';

  const query = `
    query {
      viewer {
        accounts(filter: { accountTag: "${env.CF_ACCOUNT_ID}" }) {
          workersInvocationsAdaptive(
            limit: 10000
            filter: {
              datetime_geq: "${start.toISOString()}"
              datetime_leq: "${now.toISOString()}"
              ${scriptFilter}
            }
          ) {
            sum {
              requests
              subrequests
              errors
              durationMs
            }
          }
        }
      }
    }
  `;

  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`GraphQL API ${r.status}: ${text.slice(0, 200)}`);
  }

  const data = await r.json();
  if (data.errors?.length) {
    throw new Error(data.errors.map(e => e.message).join('; '));
  }

  const groups = data?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];

  const used = groups.reduce((sum, g) => sum + (g.sum?.requests || 0), 0);
  const subrequests = groups.reduce((sum, g) => sum + (g.sum?.subrequests || 0), 0);
  const errors = groups.reduce((sum, g) => sum + (g.sum?.errors || 0), 0);
  const durationMs = groups.reduce((sum, g) => sum + (g.sum?.durationMs || 0), 0);

  return {
    used,
    subrequests,
    errors,
    durationMs,
    limit: null
  };
}
