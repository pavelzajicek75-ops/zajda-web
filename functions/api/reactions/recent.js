// /functions/api/reactions/recent.js
//
// GET /api/reactions/recent → posledních pár reakcí napříč CELÝM webem
// (ne jen jedním článkem) — podklad pro "živý tiker" na homepage
// ("🚀 Někdo právě reagoval na ‚Název článku‘"). Veřejné, bez auth —
// zobrazuje se všem návštěvníkům, ne jen adminovi (na rozdíl od
// stats.js, což je čistě admin přehled).
//
// Prochází lehké log-záznamy založené v react.js (klíče tvaru
// "reaction-log:YYYY-MM-DD:timestamp:articleId:emojiKey") od DNEŠKA
// zpátky v čase, dokud nenasbírá dost položek nebo nedojde na hranici
// prohledávané historie (14 dní — dost i pro klidnější web, kde
// reakce nechodí každý den).

const MAX_ITEMS = 15;
const MAX_DAYS_BACK = 14;

export async function onRequestGet(context) {
  const { env } = context;

  const foundKeys = [];
  const today = new Date();
  for (let i = 0; i < MAX_DAYS_BACK && foundKeys.length < MAX_ITEMS; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayList = await env.ARTICLES.list({ prefix: `reaction-log:${dayStr}:` });
    // Klíče v rámci jednoho dne jsou díky timestampu v klíči chronologické
    // (vzestupně) — chceme nejnovější, proto se berou od konce pole.
    const keysNewestFirst = dayList.keys.slice().reverse();
    for (const k of keysNewestFirst) {
      foundKeys.push(k.name);
      if (foundKeys.length >= MAX_ITEMS) break;
    }
  }

  if (!foundKeys.length) {
    return Response.json({ items: [] });
  }

  // Rozparsovat klíče: "reaction-log:2026-09-17:1758099999999:art123:rocket"
  const parsed = foundKeys.map(key => {
    const parts = key.split(':');
    // parts = ["reaction-log", "2026-09-17", "<timestamp>", "<articleId...>", "<emojiKey>"]
    // articleId teoreticky může obsahovat dvojtečku, proto se emojiKey bere
    // z konce a articleId je zbytek mezi timestampem a emojiKey.
    const emojiKey = parts[parts.length - 1];
    const timestamp = parseInt(parts[2], 10) || 0;
    const articleId = parts.slice(3, -1).join(':');
    return { articleId, emojiKey, timestamp };
  });

  // Dotáhnout tituly článků (jen jednou na unikátní ID) a config reakcí.
  const uniqueArticleIds = [...new Set(parsed.map(p => p.articleId))];
  const [articles, configData] = await Promise.all([
    Promise.all(uniqueArticleIds.map(id => env.ARTICLES.get(`article:${id}`, { type: 'json' }))),
    env.ARTICLES.get('config:reactions', { type: 'json' })
  ]);
  const titleById = {};
  uniqueArticleIds.forEach((id, i) => { titleById[id] = articles[i] ? articles[i].title : null; });
  const reactionDefs = {};
  ((configData && configData.reactions) || []).forEach(r => { reactionDefs[r.key] = r; });

  const items = parsed
    .filter(p => titleById[p.articleId]) // vynechat smazané/neexistující články
    .map(p => {
      const def = reactionDefs[p.emojiKey];
      return {
        articleId: p.articleId,
        articleTitle: titleById[p.articleId],
        emoji: def ? def.emoji : null,
        iconUrl: def ? def.iconUrl : null,
        label: def ? def.label : null,
        timestamp: p.timestamp
      };
    });

  return Response.json({ items });
}
