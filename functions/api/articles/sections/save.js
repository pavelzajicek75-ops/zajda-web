// /functions/api/articles/sections/save.js
export async function onRequestPost(context) {
  const { request, env } = context;
  const bucket = env.zajda_articles;

  const body = await request.json();
  const sections = body.sections;

  await bucket.put("sections.json", JSON.stringify(sections, null, 2), {
    httpMetadata: { contentType: "application/json" }
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
