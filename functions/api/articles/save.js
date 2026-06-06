// /functions/api/articles/save.js

export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_articles;

  if (!bucket) {
    return new Response(JSON.stringify({ error: "R2 bucket zajda_articles is not bound" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST is allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();

    if (!body.id || !body.title || !body.slug) {
      return new Response(JSON.stringify({ error: "Missing required fields: id, title, slug" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const article = {
      id: body.id,
      title: body.title,
      slug: body.slug,
      content: body.content || "",
      excerpt: body.excerpt || "",
      author: body.author || "Pavel",
      created: body.created || new Date().toISOString(),
      updated: new Date().toISOString(),
      tags: body.tags || []
    };

    const key = `article-${body.id}.json`;

    await bucket.put(key, JSON.stringify(article, null, 2), {
      httpMetadata: { contentType: "application/json" }
    });

    return new Response(JSON.stringify({
      success: true,
      article,
      saved: key
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
