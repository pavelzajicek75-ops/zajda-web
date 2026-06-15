export async function onRequestGet(context) {
  const { env } = context;
  
  // Načteme VŠECHNY objekty z bucketu – žádný prefix
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
        continue; // přeskočíme ne-JSON soubory
      }
      
      // Podpora různých formátů co mohou být v R2
      const text = item.text || item.quote || item.content || item.citat || '';
      const author = item.author || item.autor || item.by || item.source || '';
      
      // Pokud to vypadá jako citát (má text), přidáme
      if (text) {
        quotes.push({
          key: obj.key,           // originální klíč v R2 (pro mazání)
          text: text,
          author: author,
          created: item.created || obj.uploaded
        });
      }
    } catch (e) {
      // ignorujeme poškozené soubory
    }
  }
  
  return Response.json(quotes);
}
