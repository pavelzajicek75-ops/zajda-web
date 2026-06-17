export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const about = {
    title: body.title || '',
    text: body.text || '',
    photos: body.photos || [],
    subsections: body.subsections || [],
    updated: Date.now()
  };
  await env.ARTICLES.put('about:zajda', JSON.stringify(about));
  return Response.json(about);
}
