export async function onRequestGet(context) {
  const { env } = context;
  
  if (!env.QUOTES_R2) {
    return Response.json({ error: 'R2 binding QUOTES_R2 není připojený. Přidej ho v Pages Settings > Functions.' }, { status: 500 });
  }

  const list = await env.QUOTES_R2.list();
  const quotes = [];

  for (const obj of list.objects || []) {
    try {
      const data = await env.QUOTES_R2.get(obj.key);
      if (!data) continue;

      let item;
      let rawText = null;
      
      try {
        item = await data.json();
      } catch {
        rawText = await data.text();
        item = { text: rawText };
      }

      let text = item.text || item.quote || item.content || item.citat || item.message || '';
      let author = item.author || item.autor || item.by || item.source || item.name || '';
      
      if (!text && rawText) text = rawText;

      if (Array.isArray(item)) {
        for (const sub of item) {
          const subText = sub.text || sub.quote || sub.content || sub.citat || '';
          const subAuthor = sub.author || sub.autor || sub.by || sub.source || '';
          if (subText) {
            quotes.push({
              key: obj.key,
              text: String(subText),
              author: String(subAuthor),
              created: sub.created || obj.uploaded
            });
          }
        }
        continue;
      }

      if (text) {
        quotes.push({
          key: obj.key,
          text: String(text),
          author: String(author),
          created: item.created || obj.uploaded
        });
      }
    } catch {}
  }

  return Response.json(quotes);
}
