export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  const slug = (body.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const subsection = { id, sectionId: body.sectionId || '', name: body.name || '', slug, order: body.order || 0, created: Date.now() };
  await env.SUBSECTIONS.put(`subsection:${id}`, JSON.stringify(subsection));
  return Response.json(subsection);
}
