// /functions/api/article/delete.js
export async function onRequestDelete(context) {
  const { request, env } = context;
  const bucket = env.zajda_articles;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });
  }

  await bucket.delete(`articles/${id}.json`);

  const listFile = await bucket.get("articles.json");
  let list = [];

  if (listFile) {
    list = JSON.parse(await listFile.text());
  }

  list = list.filter(a => a.id !== id);

  await bucket.put("articles.json", JSON.stringify(list, null, 2), {
    httpMetadata: { contentType: "application/json" }
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
