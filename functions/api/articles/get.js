// /functions/api/article/get.js
export async function onRequestGet(context) {
  const { request, env } = context;
  const bucket = env.zajda_articles;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });
  }

  const file = await bucket.get(`articles/${id}.json`);
  if (!file) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  const article = JSON.parse(await file.text());

  return new Response(JSON.stringify(article), {
    headers: { "Content-Type": "application/json" }
  });
}
