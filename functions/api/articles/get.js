export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const key = url.searchParams.get("key");

  const file = await context.env.ARTICLES_BUCKET.get(key);
  if (!file) return new Response("Not found", { status: 404 });

  const json = await file.json();
  return Response.json(json);
}
