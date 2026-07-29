// functions/_middleware.js
//
// Cloudflare Pages Functions automaticky spustí tenhle soubor u ÚPLNĚ
// KAŽDÉHO požadavku, který projde přes /functions (tj. každé /api/...
// volání), ještě než se dostane ke konkrétnímu endpointu. Používá se to
// tady jen k jedné věci: připočítat +1 do vlastního počítadla v KV podle
// dne (klíč "reqcount:YYYY-MM-DD").
//
// Díky tomu admin metriky (usage.js, usage/history.js) vůbec nepotřebují
// Cloudflare GraphQL Analytics API ani CF_API_TOKEN — počítáme si to sami.
//
// Používá stejný KV binding USAGE_KV, který už máš (viz usage.js).
//
// Pozn.: KV čtení+zápis nejsou atomické, takže při hodně souběžných
// požadavcích ve stejné vteřině se teoreticky může nějaké +1 "ztratit"
// (poslední zápis vyhrává). Pro osobní web s běžným provozem je to
// naprosto v pořádku — pro přesné počítání "kolik lidí kliklo přesně
// teď" by bylo potřeba Durable Objects, což je zbytečná komplikace pro
// tenhle účel (orientační přehled využití).

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/') && env.USAGE_KV) {
    // waitUntil = nezdržovat skutečnou odpověď čekáním na zápis do KV
    context.waitUntil(incrementRequestCount(env));
  }

  return next();
}

async function incrementRequestCount(env) {
  try {
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const key = 'reqcount:' + today;
    const current = await env.USAGE_KV.get(key);
    const count = current ? (parseInt(current, 10) || 0) : 0;
    // Uchovat dost dlouho na "6 měsíců" pohled v historii (~190 dní) + rezerva
    await env.USAGE_KV.put(key, String(count + 1), { expirationTtl: 60 * 60 * 24 * 220 });
  } catch (e) {
    // Počítání nikdy nesmí shodit skutečný požadavek — chyba se jen tiše ignoruje.
  }
}
