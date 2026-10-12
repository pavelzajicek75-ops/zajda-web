// Index klíčů v KV — náhrada za opakované operace „list“.
//
// PROČ: bezplatný plán KV povoluje jen 1 000 operací „list“ denně. Seznam názvů
// klíčů (např. všech článků) se tu proto uloží do jednoho klíče a čte se z něj
// (obyčejné čtení „get“ má limit 100 000 denně). Skutečný „list“ proběhne jen
// při obnově indexu.
//
// BEZPEČNOST: index platí nejvýš 6 hodin, pak se sám obnoví. Takže i kdyby nějaký
// zápis zapomněl index zneplatnit, nová položka se objeví nejpozději za 6 hodin.
// Smazaná položka nevadí (čtení vrátí null a přeskočí se). Funkce, které něco
// nového vytvářejí, index navíc hned zneplatní (invalidateIndex).

const TTL_MS = 6 * 3600 * 1000;
const EMPTY_TTL_MS = 3600 * 1000;

function idxKey(prefix) { return 'meta:idx:' + prefix; }

// Vrací objekt ve tvaru výsledku kv.list(): { keys: [{ name }] }.
// `store` = namespace, kde jsou data; `home` = namespace, kam se ukládá index (ARTICLES).
export async function listIndexed(store, home, prefix, opts = {}) {
  const key = idxKey(prefix + (opts.tag || ''));
  try {
    const idx = await home.get(key, { type: 'json' });
    if (idx && Array.isArray(idx.keys)) {
      const age = Date.now() - (idx.at || 0);
      const ok = idx.keys.length ? age < TTL_MS : (opts.allowEmpty && age < EMPTY_TTL_MS);
      if (ok) return { keys: idx.keys.map(name => ({ name })) };
    }
  } catch (e) { /* index nečitelný → obnovíme */ }

  const names = [];
  let cursor;
  for (let i = 0; i < 20; i++) {
    const l = await store.list({ prefix, cursor });
    for (const k of l.keys) names.push(k.name);
    if (l.list_complete || !l.cursor) break;
    cursor = l.cursor;
  }
  if (names.length || opts.allowEmpty) {
    try { await home.put(key, JSON.stringify({ at: Date.now(), keys: names })); } catch (e) { /* zápis indexu je jen bonus */ }
  }
  return { keys: names.map(name => ({ name })) };
}

// Po vytvoření nové položky: index smaž, příští čtení ho obnoví (1× list + 1× zápis).
export async function invalidateIndex(home, prefix, tag = '') {
  try { await home.delete(idxKey(prefix + tag)); } catch (e) { /* ticho */ }
}
