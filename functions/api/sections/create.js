export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  const section = {
    id,
    name: body.name || '',
    slug: body.slug || '',
    order: body.order || 0,
    created: Date.now()
  };
  await env.SECTIONS.put(`section:${id}`, JSON.stringify(section));
  return Response.json(section);
}
