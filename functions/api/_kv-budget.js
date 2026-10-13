// Automatické šetření zápisů do KV (bezplatný plán: 1 000 zápisů denně).
//
// Zobrazení článků se normálně zapisují jedno po jednom. Když dnešní zápisy (podle Cloudflare, viz
// admin/kv-metrics.js) překročí hranici, začne se zapisovat jen každé k-té zobrazení, ale s váhou k —
// celkový počet zůstane přibližně správný a spotřeba zápisů klesne.
//   dnes < 600 zápisů → k = 1 (každé zobrazení)   |  600–849 → k = 5   |  850+ → k = 20
// Když není nastavený token (CF_API_TOKEN) nebo Cloudflare neodpoví, k = 1 (nic se nemění).
// Hodnota se drží v cache na okraji sítě 5 minut, takže to nestojí žádnou operaci KV.

function cfAccount(env) { return env.CF_ACCOUNT_ID_KV || env.CF_ACCOUNT_ID || ''; }
function cfToken(env) { return env.CF_API_TOKEN_KV || env.CF_API_TOKEN || ''; }

export function factorForWrites(writes) {
  if (writes >= 850) return 20;
  if (writes >= 600) return 5;
  return 1;
}

export async function writesToday(env) {
  const account = cfAccount(env), token = cfToken(env);
  if (!account || !token) return null;
  const day = new Date().toISOString().slice(0, 10);
  const query = `query ($account: String!, $d: Date!) { viewer { accounts(filter: { accountTag: $account }) {
    kvOperationsAdaptiveGroups(limit: 100, filter: { date_geq: $d, date_leq: $d, actionType: "write" }) { sum { requests } } } } }`;
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { account, d: day } })
  });
  if (!r.ok) return null;
  const j = await r.json();
  if (j.errors && j.errors.length) return null;
  const groups = ((((j.data || {}).viewer || {}).accounts || [])[0] || {}).kvOperationsAdaptiveGroups || [];
  return groups.reduce((s, g) => s + ((g.sum && g.sum.requests) || 0), 0);
}

export async function sampleFactor(context) {
  const { env } = context;
  if (!cfAccount(env) || !cfToken(env)) return 1;
  const cacheKey = new Request('https://zajda.internal/kv-write-factor');
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const hit = await caches.default.match(cacheKey);
      if (hit) { const n = Number(await hit.text()); if (n >= 1) return n; }
    }
  } catch (e) { /* bez cache */ }
  let k = 1;
  try {
    const w = await writesToday(env);
    if (w != null) k = factorForWrites(w);
  } catch (e) { k = 1; }
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const p = caches.default.put(cacheKey, new Response(String(k), { headers: { 'Cache-Control': 'public, max-age=300' } }));
      if (context.waitUntil) context.waitUntil(p); else await p;
    }
  } catch (e) { /* jen bonus */ }
  return k;
}
