export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  const subsection = {
    id,
    sectionId: body.sectionId || '',
    name: body.name || '',
    slug: body.slug || '',
    order: body.order || 0,
    created: Date.now()
  };
  await env.SUBSECTIONS.put(`subsection:${id}`, JSON.stringify(subsection));
  return Response.json(subsection);
}
