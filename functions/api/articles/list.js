// /functions/api/articles/list.js
export async function onRequestGet(context) {
  const { env } = context;
  const bucket = env.zajda_articles;

  try {
    // Načtení souboru articles.json z R2
    const object = await bucket.get("articles.json");
    if (!object) {
      return new Response(JSON.stringify({ articles: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const text = await object.text();
    const articles = JSON.parse(text);

    // Seřazení článků podle data (nejnovější nahoře)
    articles.sort((a, b) => new Date(b.created) - new Date(a.created));

    // Vrácení seznamu článků
    return new Response(JSON.stringify({ articles }), {
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
