// functions/api/admin/usage.js
//
// GET /api/admin/usage → { requestsUsed, requestsLimit, storageUsedBytes, storageLimitBytes, buckets: [...] }
//
// OPRAVENO podle tvého skutečného wrangler.toml:
// - Místo volání externí Cloudflare R2 API (potřebovalo by R2_BUCKET_NAME,
//   který nemáš, a token s přesně sedícím oprávněním) čteme velikost
//   PŘÍMO přes R2 bindingy, které už máš nastavené: PHOTOS_R2, QUOTES_R2.
//   Žádný token, žádné externí volání, nemůže to selhat kvůli oprávněním.
// - Počet requestů pořád jede přes GraphQL Analytics API (CF_API_TOKEN +
//   CF_ACCOUNT_ID) — to jediné externí volání, co zůstává. Pokud token
//   nemá oprávnění "Account Analytics: Read", tahle ČÁST selže, ale
//   storage se stejně zobrazí (odděleně ošetřené chyby).

import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const [storage, requests] = await Promise.all([
    getR2StorageUsage(env),
    getRequestsUsage(env).catch(e => ({ used: null, limit: null, error: String(e) }))
  ]);

  return json({
    requestsUsed: requests.used,
    requestsLimit: requests.limit,
    requestsError: requests.error || null,
    storageUsedBytes: storage.totalBytes,
    storageLimitBytes: storage.limitBytes,
    buckets: storage.buckets
  });
}

/* Skutečná velikost obou R2 bucketů — přímo přes binding, žádné API volání. */
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

  // R2 Free tier: 10 GB úložiště zdarma (ověř aktuální limit na
  // https://developers.cloudflare.com/r2/pricing/, může se změnit)
  const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024;

  return { buckets: results, totalBytes, limitBytes: FREE_TIER_BYTES };
}

/* Počet requestů za posledních 30 dní přes Cloudflare GraphQL Analytics API. */
async function getRequestsUsage(env) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    throw new Error('CF_API_TOKEN nebo CF_ACCOUNT_ID není nastaveno');
  }

  const since = thirtyDaysAgo();
  const query = `
    query {
      viewer {
        accounts(filter: { accountTag: "${env.CF_ACCOUNT_ID}" }) {
          httpRequests1dGroups(
            limit: 30
            filter: { date_geq: "${since}" }
          ) {
            sum { requests }
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

  const groups = data?.data?.viewer?.accounts?.[0]?.httpRequests1dGroups || [];
  const used = groups.reduce((sum, g) => sum + (g.sum?.requests || 0), 0);

  // Workers/Pages Free plán má denní limit (ne měsíční) — 100 000 requestů/den
  // k červenci 2026, ověř aktuální hodnotu na cloudflare.com/plans
  return { used, limit: null };
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}
