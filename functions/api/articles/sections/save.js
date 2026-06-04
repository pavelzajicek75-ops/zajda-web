// /functions/api/articles/sections/save.js
export async function onRequestPost(context) {
  const { request, env } = context;
  const bucket = env.zajda_articles;

  try {
    const body = await request.json();
    const sections = body.sections;

    if (!Array.isArray(sections)) {
      return new Response(JSON.stringify({ error: "Invalid sections format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await bucket.put("sections.json", JSON.stringify(sections, null, 2), {
      httpMetadata: { contentType: "application/json" }
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
