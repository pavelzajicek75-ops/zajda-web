export async function onRequestPost(context) {
  const body = await context.request.json();
  const key = body.key;

  await context.env.ARTICLES_BUCKET.delete(key);

  return new Response("OK");
}

