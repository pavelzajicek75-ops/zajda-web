export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const sectionId = url.searchParams.get('sectionId');

  if (!sectionId) {
    return Response.json([]);
  }

  let subs = [];

  // Zkus samostatný KV namespace SUBSECTIONS
  if (env.SUBSECTIONS) {
    const list = await env.SUBSECTIONS.list({ prefix: 'subsection:' });
    for (const key of list.keys) {
      const data = await env.SUBSECTIONS.get(key.name, { type: 'json' });
      if (data) {
        if (!data.id) data.id = key.name.replace('subsection:', '');
        if (String(data.sectionId) === String(sectionId)) subs.push(data);
      }
    }
  }

  // Fallback: zkus v ARTICLES namespace s prefixem subsection:
  if (!subs.length && env.ARTICLES) {
    const list = await env.ARTICLES.list({ prefix: 'subsection:' });
    for (const key of list.keys) {
      const data = await env.ARTICLES.get(key.name, { type: 'json' });
      if (data) {
        if (!data.id) data.id = key.name.replace('subsection:', '');
        if (String(data.sectionId) === String(sectionId)) subs.push(data);
      }
    }
  }

  // Seřadit podle order
  subs.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });

  return Response.json(subs);
}
