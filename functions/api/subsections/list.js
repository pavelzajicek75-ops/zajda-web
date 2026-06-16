export async function onRequestGet(context) {
  const { env } = context;
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get('sectionId');
  
  const list = await env.SUBSECTIONS.list({ prefix: 'subsection:' });
  const subsections = [];
  for (const key of list.keys) {
    const data = await env.SUBSECTIONS.get(key.name, { type: 'json' });
    if (data && (!sectionId || data.sectionId === sectionId)) {
      subsections.push(data);
    }
  }
  return Response.json(subsections.sort((a, b) => (a.order || 0) - (b.order || 0)));
}
