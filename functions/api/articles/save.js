export async function onRequestPost(context) {
  try {
    const { request, env } = context
    const data = await request.json()

    // Ověření povinných polí
    if (!data.title || !data.category || !data.perex || !data.content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Načtení existujícího JSON souboru z R2
    const bucket = env.zajda_articles
    const object = await bucket.get("articles.json")
    let articles = []

    if (object) {
      const text = await object.text()
      articles = JSON.parse(text)
    }

    // Přidání nového článku
    const newArticle = {
      id: crypto.randomUUID(),
      title: data.title,
      category: data.category,
      perex: data.perex,
      content: data.content,
      created: data.created || Date.now()
    }

    articles.push(newArticle)

    // Uložení zpět do R2
    await bucket.put("articles.json", JSON.stringify(articles, null, 2), {
      httpMetadata: { contentType: "application/json" }
    })

    return new Response(JSON.stringify({ success: true, id: newArticle.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
}
