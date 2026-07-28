// functions/api/admin/usage/history.js
//
// GET /api/admin/usage/history?period=week|month
// → [{ label, requests, storageBytes }]
//
// Staví na STEJNÉM datasetu jako functions/api/admin/usage.js
// (workersInvocationsAdaptive), stejné proměnné prostředí
// (CF_API_TOKEN, CF_ACCOUNT_ID, volitelně CF_WORKER_SCRIPT_NAME) — jen
// se navíc žádá o rozpad podle dne (dimensions.datetime), aby šlo
// agregovat do týdnů/měsíců.
//
// Pozn. k historii: Cloudflare u Workers Analytics obvykle drží zpětně
// řádově týdny až pár měsíců (podle plánu) — pokud je "Měsíce" zobrazení
// nastavené na víc měsíců, než kolik Cloudflare skutečně drží, nejstarší
// sloupce budou prostě nulové (ne chyba, jen chybějící historická data).

import { requireAdmin, json } from '../../_auth-utils.js';

const MONTHS_CZ = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const period = url.searchParams.get('period') === 'month' ? 'month' : 'week';

  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return json({ error: 'CF_API_TOKEN nebo CF_ACCOUNT_ID není nastaveno' }, 500);
  }

  // "Týdny" = posledních 8 týdnů (56 dní), "Měsíce" = posledních 6 měsíců
  // (~185 dní) — jeden GraphQL dotaz na celý rozsah, agregace do
  // týdnů/měsíců se dopočítá tady na serveru z denních součtů.
  const daysBack = period === 'month' ? 185 : 60;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - daysBack);

  const scriptFilter = env.CF_WORKER_SCRIPT_NAME
    ? `, scriptName: "${env.CF_WORKER_SCRIPT_NAME}"`
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
            orderBy: [datetime_ASC]
          ) {
            dimensions { datetime }
            sum { requests }
          }
        }
      }
    }
  `;

  let groups = [];
  try {
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
      return json({ error: `GraphQL API ${r.status}: ${text.slice(0, 200)}` }, 502);
    }
    const data = await r.json();
    if (data.errors?.length) {
      return json({ error: data.errors.map(e => e.message).join('; ') }, 502);
    }
    groups = data?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
  } catch (e) {
    return json({ error: String(e) }, 502);
  }

  // Denní součty podle data (klíč "YYYY-MM-DD")
  const byDay = {};
  for (const g of groups) {
    const dt = g?.dimensions?.datetime;
    if (!dt) continue;
    const day = dt.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + (g?.sum?.requests || 0);
  }

  const points = await getHistoryCached(env, period, now);
  return json(points);
}

/* Stejný princip jako getRequestsUsageCached() v usage.js — historická
   data se nemění vteřinu od vteřiny, takže je zbytečné (a teď i škodlivé
   kvůli rate limitu 429) ptát se Cloudflare GraphQL API při každém
   načtení stránky nebo přepnutí Týdny/Měsíce. Cache na 10 minut. */
async function getHistoryCached(env, period, now) {
  if (!env.USAGE_KV) return await fetchHistoryFromGraphQL(env, period, now);

  const cacheKey = 'cf_usage_history_v1:' + period;
  const cached = await env.USAGE_KV.get(cacheKey, { type: 'json' });
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const fresh = await fetchHistoryFromGraphQL(env, period, now);
  // Chybovou odpověď (např. 429) si necachovat jen na chviličku, ať se
  // po vyřešení rate limitu hned zkusí znovu, místo aby to viselo 10 minut.
  const isError = fresh && fresh.length === 1 && fresh[0] && fresh[0].error;
  await env.USAGE_KV.put(cacheKey, JSON.stringify({
    expires: Date.now() + (isError ? 20000 : 600000), // 20 s při chybě, jinak 10 min
    data: fresh
  }));
  return fresh;
}

async function fetchHistoryFromGraphQL(env, period, now) {

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
