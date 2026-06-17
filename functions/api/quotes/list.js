export async function onRequestGet(context) {
  const { env } = context;
  const r2 = env.QUOTES_R2;
  
  if (!r2) return Response.json({ error: 'Chybí R2 binding QUOTES_R2' }, { status: 500 });

  const list = await r2.list();
  const quotes = [];

  for (const obj of list.objects || []) {
    try {
      const data = await r2.get(obj.key);
      if (!data) continue;
      let item, raw = null;
      try { item = await data.json(); } 
      catch { raw = await data.text(); item = { text: raw }; }
      
      let text = item.text || item.quote || item.content || item.citat || '';
      let author = item.author || item.autor || item.by || item.source || '';
      if (!text && raw) text = raw;

      if (Array.isArray(item)) {
        for (const sub of item) {
          const st = sub.text || sub.quote || sub.content || sub.citat || '';
          const sa = sub.author || sub.autor || sub.by || sub.source || '';
          if (st) quotes.push({ key: obj.key, text: String(st), author: String(sa), created: sub.created || obj.uploaded });
        }
        continue;
      }
      if (text) quotes.push({ key: obj.key, text: String(text), author: String(author), created: item.created || obj.uploaded });
    } catch {}
  }
  return Response.json(quotes);
}
