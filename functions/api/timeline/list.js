// GET /api/timeline/list — vrátí všechny milníky, seřazené podle data
// (nejstarší první, timeline se čte chronologicky odshora dolů/zleva
// doprava, ne "nejnovější nahoře" jako u článků).
export async function onRequestGet(context) {
  const { env } = context;
  const list = await env.ARTICLES.list({ prefix: 'timeline:' });
  const milestones = [];
  for (const key of list.keys) {
    const data = await env.ARTICLES.get(key.name, { type: 'json' });
    if (data) {
      if (!data.id) data.id = key.name.replace('timeline:', '');
      milestones.push(data);
    }
  }
  milestones.sort((a, b) => {
    const da = a.date || '', db = b.date || '';
    return da < db ? -1 : da > db ? 1 : 0;
  });
  return Response.json(milestones);
}
