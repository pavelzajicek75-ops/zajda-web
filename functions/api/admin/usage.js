// functions/api/admin/usage.js
//
// GET /api/admin/usage → JSON s aktuální spotřebou Workers requestů, R2 storage a KV
//
// Cloudflare Pages Functions upřednostní tuhle cestu před catch-all routerem
// (functions/api/[[path]].js), takže stačí přidat tenhle soubor.
//
// PROMĚNNÉ PROSTŘEDÍ (Cloudflare Pages → Settings → Environment Variables):
//   CF_API_TOKEN    — API token s právy:
//                     "Account Analytics: Read" (pro GraphQL)
//                     "Workers R2 Storage: Read" (pro R2 metadata)
//   CF_ACCOUNT_ID   — ID tvého Cloudflare účtu
//   R2_BUCKET_NAMES — názvy R2 bucketů oddělené čárkou
//                     (např. "zajda-photos,zajda-articles,zajda-quotes,zajda-sections")
//   KV_NAMESPACE_IDS — IDs KV namespaces oddělené čárkou (volitelné, pro KV monitoring)
//
// TODO: nahraď requireAuth() svým skutečným ověřením přihlášení.

async function requireAuth(request, env) {
  // PŘÍKLAD — uprav podle svého skutečného mechanismu (cookie/session/JWT...)
  const cookie = request.headers.get('Cookie') || '';
  if (!cookie.includes('session=')) {
    return false;
  }
  return true;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const authed = await requireAuth(request, env);
  if (!authed) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const [requests, r2Storage, kvUsage] = await Promise.all([
      fetchRequestsUsage(env),
      fetchR2StorageUsage(env),
      fetchKVUsage(env)
    ]);

    return new Response(JSON.stringify({
      // Workers requests
      requestsUsed: requests.used,
      requestsLimit: requests.limit,
      requestsLimitLabel: requests.limitLabel,
      // R2 storage
      r2: r2Storage,
      // KV
      kv: kvUsage,
      // Plán
      plan: env.CF_PLAN === 'paid' ? 'paid' : 'free'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/* ─── Workers Requests ─────────────────────────────────────────────── */

async function fetchRequestsUsage(env) {
  const isPaid = env.CF_PLAN === 'paid';

  // Počet requestů za posledních 30 dní přes GraphQL Analytics API
  const query = `
    query {
      viewer {
        accounts(filter: { accountTag: "${env.CF_ACCOUNT_ID}" }) {
          httpRequests1dGroups(
            limit: 30
            filter: { date_geq: "${thirtyDaysAgo()}" }
          ) {
            sum { requests }
            dimensions { date }
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

  if (!r.ok) throw new Error('GraphQL Analytics API chyba: ' + r.status);
  const data = await r.json();
  const groups = data?.data?.viewer?.accounts?.[0]?.httpRequests1dGroups || [];
  const used = groups.reduce((sum, g) => sum + (g.sum?.requests || 0), 0);

  // Workers Free: 100 000 requestů/den → za 30 dní max 3 000 000
  // Workers Paid: bez limitu
  if (isPaid) {
    return { used, limit: null, limitLabel: 'Neomezeno (Paid plán)' };
  }
  return { used, limit: 100000, limitLabel: '100 000 / den (Free plán)' };
}

/* ─── R2 Storage ───────────────────────────────────────────────────── */

async function fetchR2StorageUsage(env) {
  const bucketNames = (env.R2_BUCKET_NAMES || '').split(',').map(s => s.trim()).filter(Boolean);

  if (bucketNames.length === 0) {
    return {
      buckets: [],
      totalUsedBytes: 0,
      totalLimitBytes: 10 * 1024 * 1024 * 1024, // 10 GB free tier
      limitLabel: '10 GB (Free) / 10 GB included (Paid)'
    };
  }

  // Dotážeme všechna data za posledních 31 dní a vezmeme nejnovější záznam
  // pro každý bucket (r2StorageAdaptiveGroups obsahuje snapshoty storage)
  const startDate = thirtyOneDaysAgo();
  const endDate = todayISO();

  const query = `
    query R2StorageUsage($accountTag: String!, $startDate: Time!, $endDate: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2StorageAdaptiveGroups(
            limit: 10000
            filter: {
              datetime_geq: $startDate
              datetime_leq: $endDate
            }
            orderBy: [datetime_DESC]
          ) {
            max {
              objectCount
              uploadCount
              payloadSize
              metadataSize
            }
            dimensions {
              datetime
              bucketName
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
    body: JSON.stringify({
      query,
      variables: {
        accountTag: env.CF_ACCOUNT_ID,
        startDate,
        endDate
      }
    })
  });

  if (!r.ok) throw new Error('R2 GraphQL API chyba: ' + r.status);
  const data = await r.json();
  const groups = data?.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups || [];

  // Seskupíme podle bucketName a vezmeme nejnovější záznam
  const latestByBucket = {};
  for (const g of groups) {
    const name = g.dimensions?.bucketName;
    if (!name || !bucketNames.includes(name)) continue;
    const dt = g.dimensions?.datetime;
    if (!latestByBucket[name] || dt > latestByBucket[name].datetime) {
      latestByBucket[name] = {
        datetime: dt,
        objectCount: g.max?.objectCount || 0,
        payloadSize: g.max?.payloadSize || 0,
        metadataSize: g.max?.metadataSize || 0,
        uploadCount: g.max?.uploadCount || 0
      };
    }
  }

  const buckets = bucketNames.map(name => {
    const info = latestByBucket[name] || { objectCount: 0, payloadSize: 0, metadataSize: 0 };
    return {
      name,
      objectCount: info.objectCount,
      usedBytes: info.payloadSize + info.metadataSize,
      payloadBytes: info.payloadSize,
      metadataBytes: info.metadataSize
    };
  });

  const totalUsedBytes = buckets.reduce((sum, b) => sum + b.usedBytes, 0);

  // R2 Free tier: 10 GB-month storage
  // R2 Paid: 10 GB included, pak $0.015/GB-month
  const isPaid = env.CF_PLAN === 'paid';
  const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

  return {
    buckets,
    totalUsedBytes,
    totalLimitBytes: FREE_TIER_BYTES,
    limitLabel: isPaid
      ? '10 GB included, pak $0.015/GB-month (Paid)'
      : '10 GB-month (Free)'
  };
}

/* ─── KV Usage ─────────────────────────────────────────────────────── */

async function fetchKVUsage(env) {
  const namespaceIds = (env.KV_NAMESPACE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

  if (namespaceIds.length === 0) {
    return {
      namespaces: [],
      totalStorageBytes: 0,
      limitLabel: '1 GB (Free) / 1 GB included + $0.50/GB-month (Paid)'
    };
  }

  // KV storage nelze přímo zjistit přes API — odhadneme z list operace
  // (počet klíčů a velikost hodnot). Tohle je aproximace.
  // Pro přesnější data je třeba použít Cloudflare GraphQL Analytics API
  // s datasetem kvStorageAdaptiveGroups (pokud je dostupný).
  //
  // Alternativně: pro každý namespace zavoláme list a sečteme velikosti.
  // POZOR: tohle může být drahé na počet requestů u velkých namespaces.

  const isPaid = env.CF_PLAN === 'paid';

  // GraphQL dotaz na KV storage (pokud je dostupný)
  const startDate = thirtyDaysAgo();
  const endDate = todayISO();

  const query = `
    query KVUsage($accountTag: String!, $startDate: Time!, $endDate: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          kvStorageAdaptiveGroups(
            limit: 10000
            filter: {
              datetime_geq: $startDate
              datetime_leq: $endDate
            }
            orderBy: [datetime_DESC]
          ) {
            max {
              byteCount
              keyCount
            }
            dimensions {
              datetime
              namespaceId
            }
          }
        }
      }
    }
  `;

  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        variables: {
          accountTag: env.CF_ACCOUNT_ID,
          startDate,
          endDate
        }
      })
    });

    if (!r.ok) throw new Error('KV GraphQL API chyba: ' + r.status);
    const data = await r.json();
    const groups = data?.data?.viewer?.accounts?.[0]?.kvStorageAdaptiveGroups || [];

    // Seskupíme podle namespaceId a vezmeme nejnovější
    const latestByNs = {};
    for (const g of groups) {
      const nsId = g.dimensions?.namespaceId;
      if (!nsId || !namespaceIds.includes(nsId)) continue;
      const dt = g.dimensions?.datetime;
      if (!latestByNs[nsId] || dt > latestByNs[nsId].datetime) {
        latestByNs[nsId] = {
          datetime: dt,
          byteCount: g.max?.byteCount || 0,
          keyCount: g.max?.keyCount || 0
        };
      }
    }

    const namespaces = namespaceIds.map(id => {
      const info = latestByNs[id] || { byteCount: 0, keyCount: 0 };
      return {
        namespaceId: id,
        keyCount: info.keyCount,
        storageBytes: info.byteCount
      };
    });

    const totalStorageBytes = namespaces.reduce((sum, ns) => sum + ns.storageBytes, 0);

    return {
      namespaces,
      totalStorageBytes,
      limitLabel: isPaid
        ? '1 GB included, pak $0.50/GB-month (Paid)'
        : '1 GB (Free)'
    };
  } catch (e) {
    // Pokud kvStorageAdaptiveGroups není dostupný, vrátíme prázdná data
    return {
      namespaces: [],
      totalStorageBytes: 0,
      error: 'KV storage data nedostupná: ' + String(e),
      limitLabel: isPaid
        ? '1 GB included, pak $0.50/GB-month (Paid)'
        : '1 GB (Free)'
    };
  }
}

/* ─── Helper funkce ────────────────────────────────────────────────── */

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

function thirtyOneDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 31);
  return d.toISOString();
}

function todayISO() {
  return new Date().toISOString();
}
