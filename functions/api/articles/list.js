// /functions/api/articles/list.js

export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_articles;

  if (!bucket) {
    return new Response(JSON.stringify({ error: "R2 bucket zajda_articles is not bound" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const articles = [];
    let cursor;

    while (true) {
      const result = await bucket.list({ cursor, prefix: "article-", limit: 100 });

      for (const object of result.objects) {
        const text = await bucket.get(object.key);
        if (text) {
          const content = await text.text();
          const data = JSON.parse(content);
          articles.push({
            id: data.id,
            title: data.title,
            slug: data.slug,
            excerpt: data.excerpt,
            created: data.created,
            updated: data.updated,
            author: data.author
          });
        }
      }

      if (!result.truncated) break;
      cursor = result.cursor;
    }

    // Sort by created date descending
    articles.sort((a, b) => new Date(b.created) - new Date(a.created));

    return new Response(JSON.stringify({ articles }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
