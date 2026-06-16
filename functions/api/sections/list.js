export async function onRequestGet(context) {
  const { env } = context;
  const list = await env.SUBSECTIONS.list({ prefix: 'section:' });
  const sections = [];
  for (const key of list.keys) {
    const data = await env.SUBSECTIONS.get(key.name, { type: 'json' });
    if (data) sections.push(data);
  }
  return Response.json(sections.sort((a, b) => (a.order || 0) - (b.order || 0)));
}
