// functions/api/[[path]].js — zachytává jen cesty, pro které neexistuje vlastní soubor.
// Dřív tu byla stará verze API BEZ ověření (šlo přes ni zapisovat do KV a R2 komukoli).
// Teď vrací jen 404; všechno skutečné je v samostatných souborech (s ověřením tam, kde je potřeba).
export async function onRequest(context) {
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}
