export async function onRequestGet(context) {
  const { env } = context;
  const list = await env['zajda-quotes'].list();
  const quotes = [];

  for (const obj of list.objects || []) {
    try {
      const data = await env['zajda-quotes'].get(obj.key);
      if (!data) continue;

      let item;
      let rawText = null;
      
      try {
        item = await data.json();
      } catch {
        // Pokud to není JSON, zkusíme text
        rawText = await data.text();
        item = { text: rawText };
      }

      // Podpora různých formátů
      let text = item.text || item.quote || item.content || item.citat || item.message || '';
      let author = item.author || item.autor || item.by || item.source || item.name || '';
      
      // Pokud je text prázdný ale máme rawText
      if (!text && rawText) text = rawText;

      // Pokud je to pole citátů v jednom souboru
      if (Array.isArray(item)) {
        for (const sub of item) {
          const subText = sub.text || sub.quote || sub.content || sub.citat || '';
          const subAuthor = sub.author || sub.autor || sub.by || sub.source || '';
          if (subText) {
            quotes.push({
              key: obj.key,
              text: subText,
              author: subAuthor,
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
