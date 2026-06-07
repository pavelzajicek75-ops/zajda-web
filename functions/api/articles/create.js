export async function onRequest(context) {
  const bucket = context.env.ARTICLES_BUCKET;
  const body = await context.request.json();
  const id = body.id;

  await bucket.put(`articles/${id}.json`, JSON.stringify(body), {
    httpMetadata: { contentType: "application/json" }
  });

  return Response.json({ ok: true });
}
