export async function onRequestGet(context) {
  const { env } = context;
  const list = await env.ARTICLES.list({ prefix: 'article:' });
  const articles = [];
  for (const key of list.keys) {
    const data = await env.ARTICLES.get(key.name, { type: 'json' });
    if (data) {
      // Doplň ID z klíče, pokud chybí v datech
      if (!data.id) data.id = key.name.replace('article:', '');
      articles.push(data);
    }
  }
  return Response.json(articles.sort((a, b) => (b.created || 0) - (a.created || 0)));
}
