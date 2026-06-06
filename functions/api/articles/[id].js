// /functions/api/articles/[id].js

export async function onRequestGet(context) {
  const { params, env } = context;
  const bucket = env.zajda_articles;

  if (!bucket) {
    return new Response(JSON.stringify({ error: "R2 bucket zajda_articles is not bound" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!params.id) {
    return new Response(JSON.stringify({ error: "Missing article ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const key = `article-${params.id}.json`;
    const file = await bucket.get(key);

    if (!file) {
      return new Response(JSON.stringify({ error: "Article not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const text = await file.text();
    const article = JSON.parse(text);

    return new Response(JSON.stringify(article), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestDelete(context) {
  const { params, env } = context;
  const bucket = env.zajda_articles;

  if (!bucket) {
    return new Response(JSON.stringify({ error: "R2 bucket zajda_articles is not bound" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!params.id) {
    return new Response(JSON.stringify({ error: "Missing article ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const key = `article-${params.id}.json`;
    await bucket.delete(key);

    return new Response(JSON.stringify({ success: true, deleted: key }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
