// /functions/api/articles/list.js
export async function onRequestGet(context) {
  const { env } = context;
  const bucket = env.zajda_articles;

  const file = await bucket.get("articles.json");

  if (!file) {
    return new Response(JSON.stringify({ articles: [] }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const list = JSON.parse(await file.text());

  return new Response(JSON.stringify({ articles: list }), {
    headers: { "Content-Type": "application/json" }
  });
}
