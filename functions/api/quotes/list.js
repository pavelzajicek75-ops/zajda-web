export async function onRequestGet(context) {
  const { env } = context;
  const list = await env['zajda-quotes'].list();
  const quotes = [];

  for (const obj of list.objects || []) {
    try {
      const data = await env['zajda-quotes'].get(obj.key);
      if (!data) continue;

      let item;
      try {
        item = await data.json();
      } catch {
        continue;
      }

      const text = item.text || item.quote || item.content || item.citat || '';
      const author = item.author || item.autor || item.by || item.source || '';

      if (text) {
        quotes.push({
          key: obj.key,
          text: text,
          author: author,
          created: item.created || obj.uploaded
        });
      }
    } catch {}
  }

  return Response.json(quotes);
}
