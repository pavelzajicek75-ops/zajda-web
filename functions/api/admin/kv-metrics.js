// GET /api/admin/kv-metrics — admin. Skutečná spotřeba Workers KV z Cloudflare GraphQL Analytics:
// kolik čtení / zápisů / výpisů (list) / mazání proběhlo dnes (UTC den, jako počítá Cloudflare) a za posledních 7 dní.
// Potřebuje v nastavení Pages (Variables and Secrets) dvě proměnné:
//   CF_ACCOUNT_ID  — ID účtu (Cloudflare dashboard → Workers & Pages → vpravo „Account ID“)
//   CF_API_TOKEN   — API token s oprávněním Account → Account Analytics → Read
//                    (volitelně i Workers KV Storage → Read, pak se ukážou názvy namespaců)
import { requireAdmin, json } from '../_auth-utils.js';

const LIMITS = { read: 100000, write: 1000, list: 1000, delete: 1000 };
const ACTION_MAP = { read: 'read', write: 'write', list: 'list', delete: 'delete' };

function isoDay(d) { return d.toISOString().slice(0, 10); }

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    return json({ configured: false, limits: LIMITS, missing: [!env.CF_ACCOUNT_ID && 'CF_ACCOUNT_ID', !env.CF_API_TOKEN && 'CF_API_TOKEN'].filter(Boolean) });
  }
  const today = new Date();
  const from = new Date(today.getTime() - 6 * 86400000);
  const query = `query ($account: String!, $from: Date!, $to: Date!) {
    viewer { accounts(filter: { accountTag: $account }) {
      kvOperationsAdaptiveGroups(limit: 1000, filter: { date_geq: $from, date_leq: $to }) {
        dimensions { date actionType namespaceId }
        sum { requests }
      }
    } }
  }`;
  let data;
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.CF_API_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { account: env.CF_ACCOUNT_ID, from: isoDay(from), to: isoDay(today) } })
    });
    data = await r.json();
    if (!r.ok || (data.errors && data.errors.length)) {
      const msg = (data.errors && data.errors[0] && data.errors[0].message) || ('HTTP ' + r.status);
      return json({ configured: true, error: 'Cloudflare odmítl dotaz: ' + msg, limits: LIMITS }, 502);
    }
  } catch (e) {
    return json({ configured: true, error: 'Nepodařilo se spojit s Cloudflare: ' + (e && e.message ? e.message : e), limits: LIMITS }, 502);
  }

  const rows = (((data.data || {}).viewer || {}).accounts || [])[0];
  const groups = (rows && rows.kvOperationsAdaptiveGroups) || [];
  const days = {}, nsToday = {};
  const todayKey = isoDay(today);
  for (const g of groups) {
    const d = g.dimensions || {};
    const action = ACTION_MAP[String(d.actionType || '').toLowerCase()];
    if (!action || !d.date) continue;
    const n = (g.sum && g.sum.requests) || 0;
    (days[d.date] = days[d.date] || { read: 0, write: 0, list: 0, delete: 0 })[action] += n;
    if (d.date === todayKey) {
      const ns = d.namespaceId || '?';
      (nsToday[ns] = nsToday[ns] || { read: 0, write: 0, list: 0, delete: 0 })[action] += n;
    }
  }

  // Názvy namespaců (volitelné — vyžaduje oprávnění Workers KV Storage: Read).
  const names = {};
  try {
    const nr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/storage/kv/namespaces?per_page=100`, { headers: { 'Authorization': 'Bearer ' + env.CF_API_TOKEN } });
    if (nr.ok) for (const n of ((await nr.json()).result || [])) names[n.id] = n.title;
  } catch (e) { /* bez názvů */ }

  const list = [];
  for (let i = 6; i >= 0; i--) {
    const k = isoDay(new Date(today.getTime() - i * 86400000));
    list.push({ date: k, ...(days[k] || { read: 0, write: 0, list: 0, delete: 0 }) });
  }
  return json({
    configured: true,
    limits: LIMITS,
    today: days[todayKey] || { read: 0, write: 0, list: 0, delete: 0 },
    days: list,
    namespaces: Object.keys(nsToday).map(id => ({ id, name: names[id] || id.slice(0, 8) + '…', ...nsToday[id] }))
      .sort((a, b) => (b.list + b.write) - (a.list + a.write)),
    note: 'Údaje z Cloudflare se mohou opožďovat o několik minut. Denní limit se počítá podle UTC dne.'
  });
}
